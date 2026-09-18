const form = document.querySelector('#filters-form');
const showAllButton = document.querySelector('#show-all');
const statusMessage = document.querySelector('#status');
const resultCount = document.querySelector('#result-count');
const catalogBody = document.querySelector('#catalog-body');
const newMinifiguraButton = document.querySelector('#new-minifigura');
const controls = [...form.querySelectorAll('input, button')];

const formDialog = document.querySelector('#form-dialog');
const minifiguraForm = document.querySelector('#minifigura-form');
const formDialogTitle = document.querySelector('#form-dialog-title');
const formError = document.querySelector('#form-error');
const formSubmitButton = document.querySelector('#form-submit');
const formCancelButton = document.querySelector('#form-cancel');
const formIdInput = document.querySelector('#form-id');
const formNombreInput = document.querySelector('#form-nombre');
const formDescripcionInput = document.querySelector('#form-descripcion');
const formTematicaInput = document.querySelector('#form-tematica');
const formAnioInput = document.querySelector('#form-anio');
const formEstadoInput = document.querySelector('#form-estadoColeccion');

const deleteDialog = document.querySelector('#delete-dialog');
const deleteMessage = document.querySelector('#delete-message');
const deleteConfirmButton = document.querySelector('#delete-confirm');
const deleteCancelButton = document.querySelector('#delete-cancel');

const toastRegion = document.querySelector('#toast-region');

const ERROR_MESSAGES = {
  ID_INVALIDO: 'El ID proporcionado no tiene un formato válido.',
  MINIFIGURA_INVALIDA: 'Los datos de la minifigura no son validos.',
  ID_DUPLICADO: 'Ya existe una minifigura con ese id.',
  MINIFIGURA_NO_ENCONTRADA: 'La minifigura ya no existe.',
  CATALOGO_NO_DISPONIBLE: 'El catalogo no esta disponible en este momento.',
  CATALOGO_INVALIDO: 'El catalogo no tiene un formato valido.',
};

let requestSequence = 0;
let currentFilters = {};
let currentCatalog = [];
let currentEditId = null;
let pendingDeleteId = null;

function setStatus(message, type = '') {
  statusMessage.textContent = message;
  statusMessage.className = type ? `status ${type}` : 'status';
}

function cell(value) {
  const element = document.createElement('td');
  element.textContent = value ?? '';
  return element;
}

function badgeClassFor(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'coleccion' || normalized === 'colección') {
    return 'badge-coleccion';
  }
  if (normalized === 'deseada') {
    return 'badge-deseada';
  }
  if (normalized === 'vendida') {
    return 'badge-vendida';
  }
  return 'badge-otro';
}

function badgeCell(value) {
  const element = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = `badge ${badgeClassFor(value)}`;
  badge.textContent = value ?? '';
  element.append(badge);
  return element;
}

function actionsCell(minifigura) {
  const element = document.createElement('td');
  element.className = 'actions-cell';

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'button button-secondary button-small';
  editButton.textContent = 'Editar';
  editButton.dataset.action = 'edit';
  editButton.dataset.id = minifigura.id;

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'button button-danger button-small';
  deleteButton.textContent = 'Eliminar';
  deleteButton.dataset.action = 'delete';
  deleteButton.dataset.id = minifigura.id;

  element.append(editButton, deleteButton);
  return element;
}

function renderCatalog(catalog) {
  currentCatalog = catalog;
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
      badgeCell(minifigura.estadoColeccion),
      actionsCell(minifigura),
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
  currentFilters = filters;
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

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  toastRegion.append(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function messageForErrorCode(code) {
  return ERROR_MESSAGES[code] ?? 'Ocurrio un error inesperado. Intentalo de nuevo.';
}

function openFormDialog(mode, minifigura) {
  currentEditId = mode === 'edit' ? minifigura.id : null;
  minifiguraForm.reset();
  formError.textContent = '';
  formIdInput.readOnly = mode === 'edit';
  formDialogTitle.textContent = mode === 'edit' ? 'Editar minifigura' : 'Nueva minifigura';

  if (mode === 'edit') {
    formIdInput.value = minifigura.id ?? '';
    formNombreInput.value = minifigura.nombre ?? '';
    formDescripcionInput.value = minifigura.descripcion ?? '';
    formTematicaInput.value = minifigura.tematica ?? '';
    formAnioInput.value = minifigura.anio ?? '';
    formEstadoInput.value = minifigura.estadoColeccion ?? '';
  }

  formDialog.showModal();
}

function closeFormDialog() {
  if (formDialog.open) {
    formDialog.close();
  }
}

function buildPayloadFromForm() {
  const formData = new FormData(minifiguraForm);
  const anioRaw = formData.get('anio')?.toString().trim() ?? '';
  const payload = {
    id: formData.get('id')?.toString().trim() ?? '',
    nombre: formData.get('nombre')?.toString().trim() ?? '',
    descripcion: formData.get('descripcion')?.toString().trim() ?? '',
    tematica: formData.get('tematica')?.toString().trim() ?? '',
  };

  if (anioRaw !== '' && Number.isInteger(Number(anioRaw))) {
    payload.anio = Number(anioRaw);
  }

  const estadoColeccion = formData.get('estadoColeccion')?.toString().trim() ?? '';
  if (estadoColeccion !== '') {
    payload.estadoColeccion = estadoColeccion;
  }

  return payload;
}

function validatePayload(payload) {
  if (!payload.id) {
    return 'El id es obligatorio.';
  }
  if (!payload.nombre) {
    return 'El nombre es obligatorio.';
  }
  if (!payload.tematica) {
    return 'La tematica es obligatoria.';
  }
  if (!Number.isInteger(payload.anio)) {
    return 'El anio es obligatorio y debe ser un numero entero.';
  }
  return null;
}

function openDeleteDialog(minifigura) {
  pendingDeleteId = minifigura.id;
  deleteMessage.textContent = `Se eliminara la minifigura "${minifigura.nombre}" (${minifigura.id}). Esta accion no se puede deshacer.`;
  deleteDialog.showModal();
}

function closeDeleteDialog() {
  if (deleteDialog.open) {
    deleteDialog.close();
  }
  pendingDeleteId = null;
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

newMinifiguraButton.addEventListener('click', () => {
  openFormDialog('create');
});

catalogBody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const minifigura = currentCatalog.find((item) => item.id === button.dataset.id);
  if (!minifigura) {
    return;
  }

  if (button.dataset.action === 'edit') {
    openFormDialog('edit', minifigura);
  } else if (button.dataset.action === 'delete') {
    openDeleteDialog(minifigura);
  }
});

formCancelButton.addEventListener('click', () => {
  closeFormDialog();
});

formDialog.addEventListener('close', () => {
  currentEditId = null;
});

minifiguraForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.textContent = '';

  const payload = buildPayloadFromForm();
  const validationError = validatePayload(payload);
  if (validationError) {
    formError.textContent = validationError;
    return;
  }

  const isEdit = currentEditId !== null;
  formSubmitButton.disabled = true;

  try {
    const url = isEdit ? `/minifiguras/${encodeURIComponent(currentEditId)}` : '/minifiguras';
    const response = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorCode;
      try {
        errorCode = (await response.json())?.error;
      } catch {
        errorCode = undefined;
      }
      const errorMessage = messageForErrorCode(errorCode);
      formError.textContent = errorMessage;
      showToast(errorMessage, 'error');
      return;
    }

    closeFormDialog();
    await loadCatalog(currentFilters);
    showToast(isEdit ? 'Minifigura actualizada correctamente.' : 'Minifigura creada correctamente.', 'success');
  } catch {
    const connError = 'No se pudo conectar con el servidor. Intentalo de nuevo.';
    formError.textContent = connError;
    showToast(connError, 'error');
  } finally {
    formSubmitButton.disabled = false;
  }
});

deleteCancelButton.addEventListener('click', () => {
  closeDeleteDialog();
});

deleteDialog.addEventListener('close', () => {
  pendingDeleteId = null;
});

deleteConfirmButton.addEventListener('click', async () => {
  if (!pendingDeleteId) {
    return;
  }

  const id = pendingDeleteId;
  deleteConfirmButton.disabled = true;

  try {
    const response = await fetch(`/minifiguras/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 204) {
      let errorCode;
      try {
        errorCode = (await response.json())?.error;
      } catch {
        errorCode = undefined;
      }
      showToast(messageForErrorCode(errorCode), 'error');
      return;
    }

    closeDeleteDialog();
    await loadCatalog(currentFilters);
    showToast('Minifigura eliminada correctamente.', 'success');
  } catch {
    showToast('No se pudo conectar con el servidor. Intentalo de nuevo.', 'error');
  } finally {
    deleteConfirmButton.disabled = false;
  }
});

loadCatalog();
