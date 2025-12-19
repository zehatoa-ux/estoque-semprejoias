// src/config/constants.js

export const MASTER_PIN = "1234";

// Link da planilha (pode manter o mesmo ou mudar se quiser testar outro catálogo)
export const DEFAULT_XLSX_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRseAVjs6VEwSUFJJOSnBgXS5ssRC9oT5Yl-TZ6vSILaG7JKQnFT9YG1yBryVBDGBzbnXATtn4ot0-F/pub?output=xlsx";

export const STORAGE_KEY = "estoque_catalog_cache";

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAhk5a8MdWaqlveF5MM2lv2oAHyUIVMVxY",
  authDomain: "estoque-sempre-joias.firebaseapp.com",
  projectId: "estoque-sempre-joias",
  storageBucket: "estoque-sempre-joias.firebasestorage.app",
  messagingSenderId: "1015159286438",
  appId: "1:1015159286438:web:3d02de1106cf4d4e7fe267",
};

// --- BANCO DE DADOS ATIVO ---
// Mude para "estoque-oficial" quando for subir para produção.
// Por enquanto, usamos este nome para criar um ambiente isolado.
export const APP_COLLECTION_ID = "estoque-teste-modular-v1";
