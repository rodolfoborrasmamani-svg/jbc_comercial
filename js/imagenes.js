/* =====================================================
   JBC COMERCIAL — IMÁGENES DE PRODUCTOS
   El administrador sube las fotos desde la página a Supabase Storage
   (bucket «productos»). La base NO guarda las fotos: la columna
   productos.imagen_archivo guarda solo el NOMBRE del archivo.
   Antes de subir, cada foto se reduce en el navegador (máximo 800 px,
   JPG) para que pese unos 50–200 KB.
   También se siguen mostrando las fotos enlazadas desde la carpeta
   del sitio (imagenes/productos/12.jpg) o con dirección https.
   Requiere `sup` y utilidades.js. Ver sql/imagenes.sql
===================================================== */

// Columna de productos donde se guarda el nombre del archivo. No se usa la
// columna «imagen» porque en esta base ya tiene números de otro uso.
const COL_IMAGEN = "imagen_archivo";
const BUCKET_IMAGENES = "productos";
const RUTA_CARPETA_IMAGENES = "imagenes/productos/";
const LADO_MAXIMO_IMAGEN = 800; // px del lado más largo
const CALIDAD_JPG = 0.82;
const MAX_ORIGINAL_MB = 15; // límite del archivo que elige la persona
const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"];

// Raíz del sitio (la carpeta que contiene js/, pages/, imagenes/)
const RAIZ_SITIO = new URL(
  "../",
  document.currentScript ? document.currentScript.src : window.location.href,
).href;

// =====================================================
// DIRECCIÓN PÚBLICA
// =====================================================

// Valor guardado en productos.imagen -> dirección para <img src>
function urlImagen(valor) {
  if (!valor) return "";

  // Dirección completa (https)
  if (/^https:\/\//i.test(valor)) return valor;

  // Archivo de la carpeta del sitio
  if (valor.startsWith(RUTA_CARPETA_IMAGENES)) {
    const nombre = valor.slice(RUTA_CARPETA_IMAGENES.length);

    return /^[^\/\\?#%:*"<>|]+\.(jpe?g|png|webp)$/i.test(nombre) &&
      !nombre.startsWith(".")
      ? RAIZ_SITIO + RUTA_CARPETA_IMAGENES + encodeURIComponent(nombre)
      : "";
  }

  // Imagen subida a Supabase Storage
  try {
    return (
      sup.storage.from(BUCKET_IMAGENES).getPublicUrl(valor).data.publicUrl || ""
    );
  } catch (e) {
    return "";
  }
}

// "12.jpg", "12_frente.png", "12 (2).webp" -> 12 (código del producto)
// El nombre debe EMPEZAR con el código y terminar en .jpg, .png o .webp
function codigoDesdeNombreArchivo(nombre) {
  const m = /^(\d{1,9})(?!\d).*\.(jpe?g|png|webp)$/i.exec(
    String(nombre || "").trim(),
  );
  return m ? Number(m[1]) : null;
}

// =====================================================
// VALIDAR Y REDUCIR
// =====================================================

function tipoDeArchivo(archivo) {
  if (archivo.type) return archivo.type.toLowerCase();

  const ext = (String(archivo.name).split(".").pop() || "").toLowerCase();

  return ext === "png"
    ? "image/png"
    : ext === "webp"
      ? "image/webp"
      : "image/jpeg";
}

// Devuelve un texto de error, o "" si el archivo sirve
function validarArchivoImagen(archivo) {
  if (!archivo) return "No se eligió ningún archivo.";

  if (!TIPOS_IMAGEN.includes(tipoDeArchivo(archivo))) {
    return "Formato no permitido (use JPG, PNG o WEBP).";
  }

  if (archivo.size > MAX_ORIGINAL_MB * 1024 * 1024) {
    return "El archivo pesa más de " + MAX_ORIGINAL_MB + " MB.";
  }

  return "";
}

// Reduce la imagen y la convierte a JPG (fondo blanco si tenía transparencia)
async function reducirImagen(archivo) {
  let bitmap;

  try {
    bitmap = await createImageBitmap(archivo, {
      imageOrientation: "from-image",
    });
  } catch (e) {
    throw new Error("No se pudo leer la imagen (¿archivo dañado?).");
  }

  const escala = Math.min(
    1,
    LADO_MAXIMO_IMAGEN / Math.max(bitmap.width, bitmap.height),
  );
  const ancho = Math.max(1, Math.round(bitmap.width * escala));
  const alto = Math.max(1, Math.round(bitmap.height * escala));

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;

  const ctx = lienzo.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(bitmap, 0, 0, ancho, alto);

  if (bitmap.close) bitmap.close();

  const blob = await new Promise(function (resolver) {
    lienzo.toBlob(resolver, "image/jpeg", CALIDAD_JPG);
  });

  if (!blob) throw new Error("No se pudo preparar la imagen.");

  return blob;
}

// =====================================================
// STORAGE + TABLA
// =====================================================

// Borra un archivo de Storage; si falla no importa (solo queda un archivo suelto).
// Las fotos de la carpeta del sitio y las direcciones https no se tocan.
async function borrarArchivoImagen(valor) {
  if (
    !valor ||
    /^https?:\/\//i.test(valor) ||
    valor.startsWith(RUTA_CARPETA_IMAGENES)
  )
    return;

  try {
    await sup.storage.from(BUCKET_IMAGENES).remove([valor]);
  } catch (e) {
    console.error("No se pudo borrar la imagen anterior:", e);
  }
}

// Texto claro para los errores de Storage
function textoErrorImagen(error) {
  const msg = String((error && error.message) || "").toLowerCase();

  if (
    msg.includes("row-level security") ||
    msg.includes("not authorized") ||
    msg.includes("unauthorized")
  ) {
    return "No tiene permiso para subir imágenes (inicie sesión como administrador y ejecute sql/imagenes.sql).";
  }
  if (msg.includes("bucket not found")) {
    return "Falta crear el bucket «productos». Ejecute sql/imagenes.sql en Supabase.";
  }
  if (
    msg.includes("exceeded") ||
    msg.includes("too large") ||
    msg.includes("payload")
  ) {
    return "La imagen es demasiado pesada.";
  }
  if (msg.includes("mime")) {
    return "Formato no permitido (use JPG, PNG o WEBP).";
  }
  return (error && error.message) || "Error desconocido.";
}

// Sube la imagen de UN producto y guarda su nombre en productos.imagen.
// Devuelve el nombre del archivo nuevo. `anterior` = lo que tenía (si era de
// Storage se borra para liberar espacio).
async function subirImagenProducto(idProducto, archivo, anterior) {
  const problema = validarArchivoImagen(archivo);
  if (problema) throw new Error(problema);

  const blob = await reducirImagen(archivo);

  // Nombre único: así el navegador nunca muestra una imagen vieja en caché
  const nombre = idProducto + "-" + Date.now() + ".jpg";

  const subida = await sup.storage.from(BUCKET_IMAGENES).upload(nombre, blob, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });

  if (subida.error) throw new Error(textoErrorImagen(subida.error));

  const cambios = {};
  cambios[COL_IMAGEN] = nombre;

  const guardado = await sup
    .from("productos")
    .update(cambios)
    .eq("id_productos", idProducto)
    .select("id_productos");

  if (guardado.error || !guardado.data || guardado.data.length === 0) {
    await borrarArchivoImagen(nombre); // no deja archivos sueltos
    throw new Error(
      guardado.error
        ? guardado.error.message
        : "La base no permitió guardar la imagen (revise los permisos de productos).",
    );
  }

  if (anterior && anterior !== nombre) await borrarArchivoImagen(anterior);

  return nombre;
}

// Quita la imagen de un producto (limpia la columna y libera el archivo)
async function quitarImagenProducto(idProducto, anterior) {
  const quitar = {};
  quitar[COL_IMAGEN] = null;

  const r = await sup
    .from("productos")
    .update(quitar)
    .eq("id_productos", idProducto)
    .select("id_productos");

  if (r.error || !r.data || r.data.length === 0) {
    throw new Error(
      r.error ? r.error.message : "La base no permitió quitar la imagen.",
    );
  }

  await borrarArchivoImagen(anterior);
}

// =====================================================
// MINIATURAS Y AMPLIACIÓN (catálogo público)
// =====================================================

// Si una imagen no carga, se muestra el recuadro vacío en su lugar
document.addEventListener(
  "error",
  function (e) {
    const img = e.target;

    if (
      !(img instanceof HTMLImageElement) ||
      !img.classList.contains("prod-img")
    )
      return;

    const vacia = document.createElement("span");
    vacia.className = "prod-img prod-img-vacia";
    vacia.setAttribute("aria-hidden", "true");
    vacia.textContent = "📦";

    (img.closest(".prod-img-btn") || img).replaceWith(vacia);
  },
  true,
);

const modalImagen = document.querySelector("#modal-imagen");

if (modalImagen) {
  const grande = document.querySelector("#imagen-ampliada");
  const titulo = document.querySelector("#imagen-titulo");

  function cerrarImagen() {
    modalImagen.hidden = true;
    grande.removeAttribute("src");
    document.body.classList.remove("modal-abierto");
  }

  document.addEventListener("click", function (e) {
    const boton = e.target.closest("[data-ampliar]");
    if (!boton) return;

    grande.src = boton.dataset.ampliar;
    grande.alt = boton.dataset.titulo || "";
    titulo.textContent = boton.dataset.titulo || "";
    modalImagen.hidden = false;
    document.body.classList.add("modal-abierto");
  });

  document
    .querySelector("#cerrar-imagen")
    .addEventListener("click", cerrarImagen);

  modalImagen.addEventListener("click", function (e) {
    if (e.target === modalImagen) cerrarImagen();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modalImagen.hidden) cerrarImagen();
  });
}
