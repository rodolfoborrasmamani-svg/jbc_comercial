// //funcion let const
// const iva = 0.13;
// let saldo = 100;
// saldo = saldo - 30;
// console.log(iva);
// console.log(saldo);

// // //funcion flecha
// // function saludar() {
// //   return console.log("HOLA");
// // }
// // saludar();

// const saludar = () => console.log("hola amigos");
// saludar();

// const triple = (n) => n * 3;
// console.log(triple(4));

// const ingresodisco = (edad) => {
//   if (edad >= 18) {
//     console.log("puede entrar");
//   } else {
//     console.log("no puede entrar");
//   }
// };
// ingresodisco(2);

// let cantidad = 3;
// let precio = 50;

// // const subtotal = () => console.log(3, 50);
// // subtotal();

// //template string

// // let nombre = "Elias";
// // let edad = 20;

// // //console.log(nombre  + "tiene" +edad+ "primaveras");

// // console.log(`${nombre} tiene ${edad} primaveras`);

// const usuario = {
//   id: 3,
//   nombre: "Elias",
//   rol: "admin",
//   edad: 25,
// };

// const { nombre, edad } = usuario;
// console.log(`${nombre} tiene ${edad}`);

// const respuesta = {
//   data: ["martillo,alicate, taladro"],
//   error: null,
// };

// const { data, error } = respuesta;
// console.log(`${data} y ${error}`);

// const productos = [
//   { nombre: "Martillo", precio: 45, existencia: 12 },
//   { nombre: "Taladro", precio: 350, existencia: 5 },
//   { nombre: "Clavos", precio: 15, existencia: 40 },
// ];
// const nombres = productos.map((p) => p.nombre);
// // ["Martillo", "Taladro", "Clavos"]
// const precioIva = productos.map ((p) => p.precio*1.13);
// console.log(preciosIva);

// const preciosMayoraCien = productos.map ((p)=> {
//   if (p.precio > 100); {
//   return p.nombre;};
//   else
//   {return null};
// });

// console.log(preciosMayorCien);

//filter

// const preciosMayoresaCien=productos.filter((p)=>100);
// console.log(preciosMayoresCien);
// const StockProducto = productos.filter((p)=>100)

// const pocaExistencia = productos.filter((p) => p.existencia < 10);
// // [{ nombre: "Taladro", ... }]

// const taladro = productos.find((p) => p.nombre === "Taladro");
// // { nombre: "Taladro", precio: 350, existencia: 5 }
// const totalInventario = productos.reduce((suma, p) => suma + p.precio, 0);

// console.log(totalInventario);
// // const costoTotal = productos.reduce(
// //   (total, p) => total + p.precio * p.existencia,
// //   0,
// // );

// // console.log(costoTotal);
// const costoTotal = productos.reduce(
//   (total, p) => total + p.precio * p.existencia,
//   0,
// );

// console.log(costoTotal);
function esperar(ms) {
  return new Promise((resolve) => setTimeout(() => resolve("listo"), ms));
}

const miPromesa = esperar(1000);
console.log(miPromesa);

async function ejemplo() {
  console.log("Antes de esperar ");
  const resultado = await esperar(1000);

  console.log("Desspues de esperar");
}
ejemplo();
console.log("Esto se imprime");
