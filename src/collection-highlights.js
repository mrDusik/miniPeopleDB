function collectionItems(catalog) {
  return catalog
    .map((minifigura, index) => ({ ...minifigura, index }))
    .filter(({ estadoColeccion }) => estadoColeccion === 'COLECCIÓN');
}

export function collectionHighlights(catalog) {
  const collection = collectionItems(catalog);
  const top5Precio = [...collection]
    .sort((left, right) => {
      const priceDifference = (Number.isFinite(right.precio) ? right.precio : -Infinity)
        - (Number.isFinite(left.precio) ? left.precio : -Infinity);
      if (priceDifference) return priceDifference;
      if (left.fechaCompra !== right.fechaCompra) {
        if (left.fechaCompra === undefined) return 1;
        if (right.fechaCompra === undefined) return -1;
        return left.fechaCompra.localeCompare(right.fechaCompra);
      }
      return right.index - left.index;
    })
    .slice(0, 5)
    .map(({ id, nombre, precio }) => ({ id, nombre, precio }));

  const top5Antiguedad = [...collection]
    .sort((left, right) => {
      const leftYear = Number.isInteger(left.anio) ? left.anio : Infinity;
      const rightYear = Number.isInteger(right.anio) ? right.anio : Infinity;
      if (leftYear !== rightYear) return leftYear - rightYear;
      const priceDifference = (Number.isFinite(right.precio) ? right.precio : -Infinity)
        - (Number.isFinite(left.precio) ? left.precio : -Infinity);
      if (priceDifference) return priceDifference;
      return right.index - left.index;
    })
    .slice(0, 5)
    .map(({ id, nombre, anio, precio }) => ({ id, nombre, anio, precio }));

  return { top5Precio, top5Antiguedad };
}