function snapshot(task) {
  return {
    estado: task.estado,
    procesados: task.procesados,
    total: task.total,
    actualizados: [...task.actualizados],
    fallidos: task.fallidos.map((item) => ({ ...item })),
  };
}

function createGate() {
  let resolve;
  const promise = new Promise((resolveGate) => { resolve = resolveGate; });
  return { promise, resolve };
}

async function waitWhilePaused(task) {
  while (task.pausado) {
    await task.gate.promise;
  }
}

export function createBricksetSyncJobs({ brickset }) {
  const tasks = new Map();
  const starts = new Map();

  async function process(task) {
    for (const minifigura of task.catalogo) {
      if (task.pausado) await waitWhilePaused(task);
      try {
        const precio = await brickset.getPrice(minifigura.id);
        const persisted = await task.repository.updatePrice(minifigura.id, precio);
        if (persisted === null) {
          task.fallidos.push({ id: minifigura.id, error: 'MINIFIGURA_NO_ENCONTRADA' });
        } else {
          task.actualizados.push(minifigura.id);
        }
      } catch (error) {
        task.fallidos.push({
          id: minifigura.id,
          error: error?.code ?? 'BRICKSET_NO_DISPONIBLE',
        });
      } finally {
        task.procesados += 1;
      }
    }
    task.estado = 'completada';
  }

  async function start(userId, repository) {
    const current = tasks.get(userId);
    if (current?.estado === 'en_curso') {
      return snapshot(current);
    }
    if (starts.has(userId)) {
      return starts.get(userId);
    }

    const starting = (async () => {
      const catalogo = await repository.readCatalog();
      const task = {
        estado: catalogo.length === 0 ? 'completada' : 'en_curso',
        procesados: 0,
        total: catalogo.length,
        actualizados: [],
        fallidos: [],
        catalogo,
        repository,
        pausado: false,
        gate: null,
      };
      tasks.set(userId, task);
      if (task.estado === 'en_curso') {
        void process(task);
      }
      return snapshot(task);
    })();
    starts.set(userId, starting);
    try {
      return await starting;
    } finally {
      starts.delete(userId);
    }
  }

  function status(userId) {
    const task = tasks.get(userId);
    return task ? snapshot(task) : { estado: 'inactiva' };
  }

  function refreshRepository(userId, repository) {
    const task = tasks.get(userId);
    if (task?.estado === 'en_curso') {
      task.repository = repository;
    }
  }

  function pause(userId) {
    const task = tasks.get(userId);
    if (task?.estado === 'en_curso' && !task.pausado) {
      task.pausado = true;
      task.gate = createGate();
    }
  }

  function resume(userId) {
    const task = tasks.get(userId);
    if (task?.pausado) {
      task.pausado = false;
      task.gate.resolve();
      task.gate = null;
    }
  }

  return {
    start, status, refreshRepository, pause, resume,
  };
}
