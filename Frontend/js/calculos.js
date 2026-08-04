//Mi hoja de calculos

console.log("Codexia Ds");

/*
    FUNCIÓN 1
    Calcula el precio de un producto después de aplicar un descuento.
*/
function calcularPrecioConDescuento(precio, procentajeDescuento){
    const valorDescuento = precio * (procentajeDescuento /100 );
    const preciofinal = precio - valorDescuento;
    return preciofinal;
}

/*
    FUNCIÓN 2
    Calcula el precio de un producto después de agregar un impuesto.
*/
function calcularPrecioConImpuesto(precio, porcentajeImpuesto) {
    const valorImpuesto = precio * (porcentajeImpuesto / 100);
    const precioFinal = precio + valorImpuesto;

    return precioFinal;
}

/*
    FUNCIÓN 3
    Calcula el total de un pedido teniendo en cuenta:
    precio unitario, cantidad de productos y costo de envío.
*/

function calcularTotalPedido(precioUnitario, cantidad, costoEnvio) {
    if(cantidad > 5){
        costoEnvio = 0;
        console.log("El envío es gratis por comprar más de 5 productos");
    }
    const subtotal = precioUnitario * cantidad;
    let totalPedido = subtotal + costoEnvio;
    if(totalPedido > 100000){
       totalPedido = calcularPrecioConDescuento(totalPedido, 10);
        console.log("¡Felicidades! Has superado el umbral de $100,000 en tu pedido.");
    }
    return totalPedido;
}

const precioDescuento = calcularPrecioConDescuento(100000,50);
console.log("El precio con descuento es: " + precioDescuento);

const resultadoPedido = calcularTotalPedido(150000, 6, 5000);
console.log("Total del pedido:" + resultadoPedido);

const precioImpuesto = calcularPrecioConImpuesto(100000, 10);
console.log("El precio con impuesto es: " + precioImpuesto);

// funcion 4

function ahorroanual(costosemanal, semanas){
    let ahorroanual = costosemanal * semanas;
    return ahorroanual;
}

let resultadoAhorro = ahorroanual(10000, 52);
console.log("El ahorro anual es: " + resultadoAhorro);
