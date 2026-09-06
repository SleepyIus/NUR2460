/* Run before the original card engine: overlay only Anki's saved card state. */
try { window.NURAnkiPersistence = window.NURAnkiState.connect(window.localStorage, localStorage); }
catch (error) { window.NURAnkiPersistence = { error: error.message }; }
