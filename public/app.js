const form = document.querySelector('#filters-form');
const showAllButton = document.querySelector('#show-all');
const statusMessage = document.querySelector('#status');
const resultCount = document.querySelector('#result-count');
const catalogBody = document.querySelector('#catalog-body');
const controls = [...form.querySelectorAll('input, button')];
let requestSequence = 0;

function setStatus(message, type = '') {
  statusMessage.textContent = message;
  statusMessage.className = type ? `status ${type}` : 'status';
}

function cell(value) {
  const element = document.createElement('td');
  element.textContent = value ?? '';
  return element;
}

function renderCatalog(catalog) {
  catalogBody.replaceChildren();
  resultCount.textContent = `${catalog.length} ${catalog.length === 1 ? 'figura' : 'figuras'}`;

  for (const minifigura of catalog) {
    const row = document.createElement('tr');
    row.append(
      cell(minifigura.id),
      cell(minifigura.nombre),
      cell(minifigura.descripcion),
      cell(minifigura.tematica),
      cell(minifigura.anio),
      cell(minifigura.estadoColeccion),
    );
    catalogBody.append(row);
  }

  if (catalog.length === 0) {
    setStatus('No hay minifiguras que coincidan con la consulta.');
  } else {
    setStatus('Catalogo actualizado.');
  }
}

function setLoading(isLoading) {
  controls.forEach((control) => { control.disabled = isLoading; });
  if (isLoading) {
    setStatus('Cargando catalogo...');
  }
}

async function loadCatalog(filters = {}) {
  const currentRequest = ++requestSequence;
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
  const query = params.toString();
  setLoading(true);

  try {
    const response = await fetch(`/minifiguras${query ? `?${query}` : ''}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const catalog = await response.json();
    if (!Array.isArray(catalog)) {
      throw new Error('Respuesta invalida');
    }
    if (currentRequest === requestSequence) {
      renderCatalog(catalog);
    }
  } catch {
    if (currentRequest === requestSequence) {
      catalogBody.replaceChildren();
      resultCount.textContent = '';
      setStatus('No se pudo cargar el catalogo. Intentalo de nuevo.', 'error');
    }
  } finally {
    if (currentRequest === requestSequence) {
      setLoading(false);
    }
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  loadCatalog({
    tema: formData.get('tema').trim(),
    anio: formData.get('anio').trim(),
    estadoColeccion: formData.get('estadoColeccion').trim(),
  });
});

showAllButton.addEventListener('click', () => {
  form.reset();
  loadCatalog();
});

loadCatalog();
