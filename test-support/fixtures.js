export const categoriasMock = [
  { categoria: 'Space', total: 230, subcategorias: [] },
  { categoria: 'Castle', total: 100, subcategorias: [] },
  { categoria: 'Collectible Minifigures', total: 845, subcategorias: [
    { subcategoria: 'Team GB', total: 8 },
    { subcategoria: 'The LEGO Movie', total: 20 },
    { subcategoria: 'Series 3 Minifigures', total: 16 },
    { subcategoria: 'Series 17 Minifigures', total: 16 },
  ] },
  { categoria: 'Stranger Things', total: 15, subcategorias: [] },
  { categoria: 'Harry Potter', total: 200, subcategorias: [] },
  { categoria: 'Disney', total: 100, subcategorias: [] },
  { categoria: 'Super Mario', total: 50, subcategorias: [] },
  { categoria: 'Sonic the Hedgehog', total: 10, subcategorias: [] },
  { categoria: 'Dimensions', total: 20, subcategorias: [] },
  { categoria: 'Star Wars', total: 500, subcategorias: [] },
];

export const categoriasMockRaw = JSON.stringify(categoriasMock);