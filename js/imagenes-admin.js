/* =====================================================
   JBC COMERCIAL — SUBIR IMÁGENES POR CÓDIGO (solo administrador)
   Cada archivo se nombra con el código del producto:
     12.jpg  ->  producto 12
     15.png  ->  producto 15
   Se pueden elegir varios a la vez. La seguridad real está en las
   políticas de Storage (sql/imagenes.sql): solo el administrador sube.
   Requiere imagenes.js y productos.js (esAdmin, cargarProductos)
===================================================== */

const MAX_ARCHIVOS_POR_VEZ = 50;

const formImagenes = document.querySelector("#form-imagenes");
const inputImagenes = document.querySelector("#archivos-imagenes");
const mensajeImagenes = document.querySelector("#mensaje-imagenes");
const resultadosImagenes = document.querySelector("#resultados-imagenes");
const btnSubirImagenes = document.querySelector("#btn-subir-imagenes");

function agregarResultado(texto, tipo) {
  const li = document.createElement("li");
  li.className = "img-res " + tipo;
  li.textContent = texto;
  resultadosImagenes.appendChild(li);
}

formImagenes.addEventListener("submit", async function (event) {
  event.preventDefault();

  if (!esAdmin) return;

  const archivos = Array.from(inputImagenes.files);

  resultadosImagenes.innerHTML = "";

  if (archivos.length === 0) {
    mostrarMensaje(mensajeImagenes, "Elija una o más imágenes.", "error");
    return;
  }

  if (archivos.length > MAX_ARCHIVOS_POR_VEZ) {
    mostrarMensaje(
      mensajeImagenes,
      "Elija como máximo " + MAX_ARCHIVOS_POR_VEZ + " imágenes por vez.",
      "error",
    );
    return;
  }

  btnSubirImagenes.disabled = true;

  let subidas = 0;
  let fallidas = 0;
  const vistos = new Set(); // un producto solo recibe una imagen por tanda

  try {
    for (let i = 0; i < archivos.length; i++) {
      const archivo = archivos[i];

      mostrarMensaje(
        mensajeImagenes,
        "Subiendo " + (i + 1) + " de " + archivos.length + "…",
      );

      const codigo = codigoDesdeNombreArchivo(archivo.name);

      if (codigo === null) {
        agregarResultado(
          archivo.name +
            (/^\d/.test(archivo.name)
              ? ": Formato no permitido (use JPG, PNG o WEBP)."
              : ": el nombre debe empezar con el código del producto (ej. 12.jpg)."),
          "error",
        );
        fallidas++;
        continue;
      }

      if (vistos.has(codigo)) {
        agregarResultado(
          archivo.name +
            ": ya hay otra imagen para el producto " +
            codigo +
            " en esta tanda.",
          "error",
        );
        fallidas++;
        continue;
      }

      vistos.add(codigo);

      try {
        const producto = await sup
          .from("productos")
          .select("*")
          .eq("id_productos", codigo)
          .maybeSingle();

        if (producto.error) throw new Error(producto.error.message);

        if (!producto.data) {
          throw new Error("no existe el producto con código " + codigo + ".");
        }

        await subirImagenProducto(codigo, archivo, producto.data[COL_IMAGEN]);

        agregarResultado(
          archivo.name +
            " → " +
            producto.data.nombre +
            " (código " +
            codigo +
            ")",
          "ok",
        );
        subidas++;
      } catch (error) {
        console.error("Error al subir " + archivo.name + ":", error);
        agregarResultado(archivo.name + ": " + error.message, "error");
        fallidas++;
      }
    }
  } finally {
    btnSubirImagenes.disabled = false;
  }

  mostrarMensaje(
    mensajeImagenes,
    subidas +
      (subidas === 1 ? " imagen subida" : " imágenes subidas") +
      (fallidas ? " · " + fallidas + " con error" : "") +
      ".",
    fallidas ? "error" : "ok",
  );

  inputImagenes.value = "";
  await cargarProductos();
});
