/* =====================================================
   JBC COMERCIAL — RESUMEN DE VENTAS
   Lista las ventas de un período (filtrable por fecha), calcula
   el total en el navegador y lo VERIFICA contra SQL mediante la
   función resumen_ventas() de la base de datos.
   Requiere `sup`, utilidades.js y sql/resumen_ventas.sql
===================================================== */

// Bolivia no tiene horario de verano: el desfase es fijo (UTC-4)
const DESFASE_BOLIVIA = "-04:00";
const TAMANO_PAGINA = 1000; // límite por consulta de Supabase

// =====================================================
// ELEMENTOS DEL HTML
// =====================================================

const resDesde = document.querySelector("#resumen-desde");
const resHasta = document.querySelector("#resumen-hasta");
const resBtnConsultar = document.querySelector("#btn-consultar-resumen");
const resBtnLimpiar = document.querySelector("#btn-limpiar-resumen");
const resMensaje = document.querySelector("#mensaje-resumen");
const resCuerpo = document.querySelector("#cuerpo-resumen");
const resNumVentas = document.querySelector("#resumen-num-ventas");
const resTotal = document.querySelector("#total-periodo");
const resPromedio = document.querySelector("#resumen-promedio");
const resVerificacion = document.querySelector("#resumen-verificacion");
const resAtajos = document.querySelectorAll("[data-rango]");
const resFiltroVendedor = document.querySelector("#filtro-vendedor");
const resVendedor = document.querySelector("#resumen-vendedor");

// Solo el administrador puede abrir el detalle de una venta (js/detalle-venta.js)
let resEsAdmin = false;

let vendedoresCargados = false; // la lista se carga una vez por sesión de admin

let consultaEnCurso = 0; // descarta respuestas viejas

// =====================================================
// FECHAS
// =====================================================

// Fecha local "AAAA-MM-DD" (no usa toISOString: esa pasa a UTC y
// cambiaría el día después de las 20:00 en Bolivia)
function fechaLocal(d) {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mes + "-" + dia;
}

// "2026-10-15" -> "2026-10-16" (suma días sin depender de la zona horaria)
function sumarDias(fechaISO, dias) {
  const p = fechaISO.split("-").map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + dias));
  return d.toISOString().slice(0, 10);
}

// Límites del período como instantes con hora de Bolivia.
// Coinciden con los que usa la función SQL: [desde 00:00, hasta+1 00:00)
function limitesPeriodo(desde, hasta) {
  return {
    inicio: desde ? desde + "T00:00:00" + DESFASE_BOLIVIA : null,
    fin: hasta ? sumarDias(hasta, 1) + "T00:00:00" + DESFASE_BOLIVIA : null,
  };
}

function aplicarAtajo(nombre) {
  const hoy = new Date();
  const hoyISO = fechaLocal(hoy);
  let desde = "";
  let hasta = "";

  if (nombre === "hoy") {
    desde = hasta = hoyISO;
  } else if (nombre === "7dias") {
    desde = sumarDias(hoyISO, -6);
    hasta = hoyISO;
  } else if (nombre === "mes") {
    desde = fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    hasta = hoyISO;
  }
  // "todo" deja ambas fechas vacías

  resDesde.value = desde;
  resHasta.value = hasta;
}

// Formatea el instante guardado en la base a hora de Bolivia
function formatearFecha(iso) {
  return new Date(iso).toLocaleString("es-BO", {
    timeZone: "America/La_Paz",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =====================================================
// DINERO: se redondea a centavos para evitar errores de
// coma flotante al sumar (0.1 + 0.2 = 0.30000000000000004)
// =====================================================

function aCentavos(valor) {
  return Math.round((Number(valor) || 0) * 100);
}

// =====================================================
// CONSULTAS
// =====================================================

// Lee TODAS las ventas del período (Supabase devuelve máx. 1000 por llamada)
async function leerVentas(inicio, fin, vendedor) {
  let todas = [];
  let desdeFila = 0;

  while (true) {
    let consulta = sup
      .from("ventas")
      .select("id_ventas, created_at, id_usuarios, id_cliente, total");

    // Primero los filtros; después el orden y la página
    if (inicio) consulta = consulta.gte("created_at", inicio);
    if (fin) consulta = consulta.lt("created_at", fin);
    if (vendedor) consulta = consulta.eq("id_usuarios", vendedor);

    // Desempate por id: sin él, ventas con la misma fecha podrían
    // repetirse u omitirse entre una página y la siguiente
    const r = await consulta
      .order("created_at", { ascending: false })
      .order("id_ventas", { ascending: false })
      .range(desdeFila, desdeFila + TAMANO_PAGINA - 1);

    if (r.error) throw r.error;

    todas = todas.concat(r.data || []);

    if (!r.data || r.data.length < TAMANO_PAGINA) break;
    desdeFila += TAMANO_PAGINA;
  }

  return todas;
}

// Nombres de clientes y vendedores (según lo que permita el RLS)
async function leerNombres() {
  const resultados = await Promise.all([
    sup.from("clientes").select("*"),
    sup.from("usuarios").select("id_usuarios, nombres"),
  ]);

  const clientes = new Map();
  const usuarios = new Map();

  if (!resultados[0].error) {
    (resultados[0].data || []).forEach(function (c) {
      const pk = c.id_cliente ?? c.id_clientes ?? c.id;
      clientes.set(String(pk), c.nombres);
    });
  }

  if (!resultados[1].error) {
    (resultados[1].data || []).forEach(function (u) {
      usuarios.set(String(u.id_usuarios), u.nombres);
    });
  }

  return { clientes: clientes, usuarios: usuarios };
}

// Lista de vendedores para el filtro (solo el administrador puede leerla)
async function prepararFiltroVendedor(esAdmin) {
  if (!esAdmin) {
    resFiltroVendedor.hidden = true;
    resVendedor.value = "";
    vendedoresCargados = false;
    return;
  }

  resFiltroVendedor.hidden = false;

  if (vendedoresCargados) return;

  const r = await sup
    .from("usuarios")
    .select("id_usuarios, nombres, id_roles")
    .order("nombres", { ascending: true });

  if (r.error) {
    console.error("No se pudo cargar la lista de vendedores:", r.error);
    return;
  }

  const previo = resVendedor.value;

  resVendedor.innerHTML =
    '<option value="">Todos los vendedores</option>' +
    (r.data || [])
      .map(function (u) {
        const etiqueta =
          String(u.nombres || "")
            .replace(/\s+/g, " ")
            .trim() +
          (ROLES_ADMIN.includes(Number(u.id_roles)) ? " (administrador)" : "");

        return (
          '<option value="' +
          escapeHtml(u.id_usuarios) +
          '">' +
          escapeHtml(etiqueta) +
          "</option>"
        );
      })
      .join("");

  resVendedor.value = previo;
  vendedoresCargados = true;
}

// Total calculado por SQL (verificación independiente)
async function totalSql(desde, hasta, vendedor) {
  const r = await sup.rpc("resumen_ventas", {
    p_desde: desde || null,
    p_hasta: hasta || null,
    p_vendedor: vendedor ? Number(vendedor) : null,
  });

  if (r.error) throw r.error;

  return Array.isArray(r.data) ? r.data[0] : r.data;
}

// =====================================================
// RENDER
// =====================================================

function pintarVacio(texto, detalle) {
  resCuerpo.innerHTML =
    '<tr class="estado-fila"><td colspan="5"><div class="estado-vacio">' +
    '<div class="icono">🧾</div><h4>' +
    texto +
    "</h4><p>" +
    detalle +
    "</p></div></td></tr>";
}

function pintarVentas(ventas, nombres) {
  if (ventas.length === 0) {
    pintarVacio(
      "Sin ventas en este período",
      "Pruebe con otro rango de fechas.",
    );
    return;
  }

  resCuerpo.innerHTML = ventas
    .map(function (v) {
      const cliente =
        nombres.clientes.get(String(v.id_cliente)) || "Cliente " + v.id_cliente;
      const vendedor =
        nombres.usuarios.get(String(v.id_usuarios)) ||
        "Usuario " + v.id_usuarios;

      return (
        '<tr class="fila-dato' +
        (resEsAdmin ? " fila-clic" : "") +
        '"' +
        (resEsAdmin
          ? ' data-venta="' +
            escapeHtml(v.id_ventas) +
            '" tabindex="0" role="button" title="Ver el detalle de esta venta"'
          : "") +
        ">" +
        "<td>N.º " +
        escapeHtml(v.id_ventas) +
        "</td>" +
        "<td>" +
        escapeHtml(formatearFecha(v.created_at)) +
        "</td>" +
        "<td>" +
        escapeHtml(vendedor) +
        "</td>" +
        "<td>" +
        escapeHtml(cliente) +
        "</td>" +
        '<td class="num"><strong>' +
        formatearBs(v.total) +
        "</strong></td>" +
        "</tr>"
      );
    })
    .join("");
}

// Compara el total del navegador con el de SQL
function pintarVerificacion(ventas, sql) {
  const centNavegador = ventas.reduce(function (s, v) {
    return s + aCentavos(v.total);
  }, 0);

  const centSql = aCentavos(sql.total_ventas);
  const centDetalle = aCentavos(sql.total_detalle);
  const mismaCantidad = Number(sql.num_ventas) === ventas.length;
  const totalCoincide = centNavegador === centSql;
  const descuadradas = Number(sql.ventas_descuadradas) || 0;

  let clase = "ok";
  let titulo = "Total verificado con SQL";
  const lineas = [];

  lineas.push(
    "Calculado en pantalla: " +
      formatearBs(centNavegador / 100) +
      " · Calculado por SQL: " +
      formatearBs(centSql / 100) +
      ".",
  );

  if (!totalCoincide || !mismaCantidad) {
    clase = "error";
    titulo = "El total NO coincide con SQL";
    lineas.push(
      "Pantalla: " +
        ventas.length +
        " ventas · SQL: " +
        sql.num_ventas +
        " ventas. Vuelva a consultar; si persiste, revise la base.",
    );
  }

  if (descuadradas > 0) {
    clase = "error";
    titulo =
      totalCoincide && mismaCantidad
        ? "Total verificado, pero hay ventas descuadradas"
        : titulo;
    lineas.push(
      descuadradas +
        (descuadradas === 1 ? " venta tiene" : " ventas tienen") +
        " un total distinto a la suma de sus productos (detalle: " +
        formatearBs(centDetalle / 100) +
        ").",
    );
  } else if (totalCoincide && mismaCantidad) {
    lineas.push(
      "La suma de los productos vendidos (" +
        formatearBs(centDetalle / 100) +
        ") coincide con el total de las ventas.",
    );
  }

  resVerificacion.className = "verificacion " + clase;
  resVerificacion.innerHTML =
    "<strong>" +
    (clase === "ok" ? "✔ " : "⚠ ") +
    titulo +
    "</strong><span>" +
    lineas.map(escapeHtml).join("<br>") +
    "</span>";
  resVerificacion.hidden = false;
}

function limpiarResultados() {
  resNumVentas.textContent = "—";
  resTotal.textContent = "—";
  resPromedio.textContent = "—";
  resVerificacion.hidden = true;
}

// =====================================================
// CONSULTAR
// =====================================================

async function cargarResumen() {
  const idConsulta = ++consultaEnCurso;

  const perfil = await obtenerPerfilActual();

  if (idConsulta !== consultaEnCurso) return;

  if (!perfil) {
    resEsAdmin = false;
    limpiarResultados();
    pintarVacio(
      "Inicie sesión para ver el resumen",
      "Los datos de ventas son privados.",
    );
    mostrarMensaje(resMensaje, "");
    return;
  }

  const admin = esAdministrador(perfil);
  resEsAdmin = admin;

  await prepararFiltroVendedor(admin);

  if (idConsulta !== consultaEnCurso) return;

  const desde = resDesde.value;
  const hasta = resHasta.value;
  const vendedor = admin ? resVendedor.value : "";

  if (desde && hasta && desde > hasta) {
    mostrarMensaje(
      resMensaje,
      "La fecha «desde» no puede ser posterior a «hasta».",
      "error",
    );
    return;
  }

  const lim = limitesPeriodo(desde, hasta);

  resBtnConsultar.disabled = true;
  limpiarResultados();
  pintarVacio("Cargando…", "Consultando las ventas.");
  const vendedorElegido = vendedor
    ? resVendedor.options[resVendedor.selectedIndex].textContent
    : "";

  mostrarMensaje(
    resMensaje,
    !admin
      ? "Mostrando solo sus ventas."
      : vendedor
        ? "Mostrando solo las ventas de " + vendedorElegido + "."
        : "Mostrando las ventas de todos los vendedores.",
  );

  try {
    const resultados = await Promise.all([
      leerVentas(lim.inicio, lim.fin, vendedor),
      leerNombres(),
      totalSql(desde, hasta, vendedor),
    ]);

    if (idConsulta !== consultaEnCurso) return;

    const ventas = resultados[0];
    const nombres = resultados[1];
    const sql = resultados[2];

    const centTotal = ventas.reduce(function (s, v) {
      return s + aCentavos(v.total);
    }, 0);

    resNumVentas.textContent = ventas.length;
    resTotal.textContent = formatearBs(centTotal / 100);
    resPromedio.textContent = ventas.length
      ? formatearBs(centTotal / 100 / ventas.length)
      : "—";

    pintarVentas(ventas, nombres);
    pintarVerificacion(ventas, sql);
  } catch (error) {
    if (idConsulta !== consultaEnCurso) return;

    console.error("Error en el resumen de ventas:", error);

    // 42883 / PGRST202 = la función SQL todavía no existe
    const sinFuncion =
      error.code === "PGRST202" ||
      error.code === "42883" ||
      String(error.message || "").includes("resumen_ventas");

    pintarVacio(
      "No se pudo cargar el resumen",
      sinFuncion
        ? "Falta crear la función resumen_ventas en Supabase (sql/resumen_ventas.sql)."
        : escapeHtml(error.message || "Revise su conexión."),
    );
  } finally {
    if (idConsulta === consultaEnCurso) resBtnConsultar.disabled = false;
  }
}

// Vuelve a leer la lista de vendedores (p. ej. tras crear uno nuevo)
function recargarVendedores() {
  vendedoresCargados = false;
  return cargarResumen();
}

// =====================================================
// EVENTOS
// =====================================================

resBtnConsultar.addEventListener("click", function (e) {
  e.preventDefault();
  cargarResumen();
});

resBtnLimpiar.addEventListener("click", function () {
  aplicarAtajo("todo");
  resVendedor.value = "";
  cargarResumen();
});

resAtajos.forEach(function (boton) {
  boton.addEventListener("click", function () {
    aplicarAtajo(boton.dataset.rango);
    cargarResumen();
  });
});

[resDesde, resHasta, resVendedor].forEach(function (campo) {
  campo.addEventListener("change", cargarResumen);
});

// =====================================================
// INICIAR: por defecto, el mes en curso
// =====================================================

aplicarAtajo("mes");
cargarResumen();
