# Guía 5 — Casos de uso

## CU-01: Registrar una venta

- Historia relacionada: HU-01
- Actor principal: Vendedor (Sra. Maricruz, Brandon-Alejandro).
- Precondición: existen productos registrados en el sistema.

### Flujo principal

1. El vendedor abre la pantalla de registrar venta.
2. El vendedor busca y selecciona uno o más productos.
3. El vendedor indica la cantidad de cada producto.
4. El sistema calcula el total a cobrar.
5. El vendedor confirma la venta.
6. El sistema guarda la venta y actualiza la existencia disponible.

### Flujos alternativos

- 3a. Si la cantidad pedida supera la existencia disponible,
  el sistema avisa y no permite continuar con esa cantidad.
- 5a. Si el vendedor cancela antes de confirmar, no se guarda ningún cambio.

### Postcondición

La venta queda registrada y la existencia de los productos vendidos se actualiza.

## CU-02: Consultar existencia de un producto

• Historia relacionada: HU-02
• Actor principal: Vendedor (Marta, Luis o Don Ernesto)
• Precondición: existen productos registrados en el sistema.

### Flujo principal

1. El vendedor abre la opción de consulta de productos.
2. El vendedor escribe el nombre del producto que desea buscar.
3. El sistema busca los productos que coinciden con el nombre ingresado.
4. El vendedor selecciona el producto correspondiente.
5. El sistema muestra la cantidad disponible del producto.
6. El vendedor utiliza la información para confirmar si puede realizar la venta.

### Flujos alternativos

• 3a. Si no existe ningún producto con ese nombre, el sistema informa que no se
encontraron resultados.
• 5a. Si la existencia disponible es cero, el sistema indica que el producto está
agotado.
• 5b. Si la existencia es baja, el sistema muestra la cantidad disponible para
que el vendedor pueda informar correctamente al cliente.

### Postcondición

El vendedor conoce la existencia actual del producto sin modificar ningún dato del
inventario.

## CU-03: Registrar un nuevo producto

• Historia relacionada: HU-03
• Actor principal: Administrador (Don Ernesto)
• Precondición: el administrador tiene acceso autorizado al sistema.

### Flujo principal

1. El administrador abre la opción de registrar productos.
2. El sistema muestra el formulario de registro.
3. El administrador ingresa el nombre del producto.
4. El administrador ingresa el precio.
5. El administrador ingresa la existencia inicial.
6. El administrador confirma el registro.
7. El sistema valida los datos ingresados.
8. El sistema guarda el nuevo producto.
9. El sistema muestra el producto dentro del inventario.

### Flujos alternativos

• 6a. Si el nombre está vacío, el sistema informa que es un dato obligatorio y no
permite guardar.
• 7a. Si el precio no es un número mayor que cero, el sistema muestra un mensaje
de error.
• 7b. Si la existencia ingresada no es válida, el sistema solicita corregirla.
• 6b. Si el administrador cancela el registro, no se guarda ningún producto.

### Postcondición

El nuevo producto queda registrado y disponible para ser consultado o utilizado en
futuras ventas.

## CU-04: Consultar total vendido en un periodo

• Historia relacionada: HU-04
• Actor principal: Administrador (Don Ernesto)
• Precondición: existen ventas registradas en el sistema.

### Flujo principal

1. El administrador abre la sección de reportes de ventas.
2. El sistema muestra las opciones para seleccionar un periodo.
3. El administrador selecciona una fecha inicial.
4. El administrador selecciona una fecha final.
5. El administrador solicita generar el reporte.
6. El sistema busca las ventas registradas dentro del periodo seleccionado.
7. El sistema calcula automáticamente el total vendido.
8. El sistema muestra el total y las ventas correspondientes al periodo.

### Flujos alternativos

• 4a. Si la fecha final es anterior a la fecha inicial, el sistema informa el
error y solicita corregir las fechas.
• 6a. Si no existen ventas en el periodo seleccionado, el sistema informa que no
se encontraron ventas y muestra un total de Bs 0.
• 5a. Si el administrador cambia las fechas antes de generar el reporte, el
sistema utiliza el nuevo periodo seleccionado.

### Postcondición

El administrador obtiene el total vendido durante el periodo seleccionado sin realizar
cálculos manuales.

## CU-05: Consultar resumen de ventas desde el celular

• Historia relacionada: HU-05
• Actor principal: Administrador (Don Ernesto)
• Precondición: el administrador posee una cuenta autorizada y dispone de
conexión a Internet.

### Flujo principal

1. El administrador abre el navegador de su celular.
2. El administrador ingresa a la dirección web del sistema.
3. El sistema muestra la pantalla de inicio de sesión adaptada al celular.
4. El administrador ingresa sus datos de acceso.
5. El sistema verifica las credenciales.
6. El sistema permite el ingreso al administrador.
7. El administrador abre la opción de resumen de ventas.
8. El sistema obtiene las ventas registradas.
9. El sistema muestra el resumen de ventas adaptado al tamaño de la pantalla del
   celular.

### Flujos alternativos

• 5a. Si los datos de acceso son incorrectos, el sistema informa el error y no permite ingresar.

• 5b. Si el usuario no está autorizado, el sistema bloquea el acceso al resumen.

• 8a. Si todavía no existen ventas registradas, el sistema muestra el resumen con valores en cero.

• 2a. Si no existe conexión a Internet, el sistema no puede cargar la información y el navegador informa el problema de conexión.

### Postcondición

El administrador puede consultar de forma segura el resumen actualizado de ventas desde su celular, aunque se encuentre fuera de la ferretería.
