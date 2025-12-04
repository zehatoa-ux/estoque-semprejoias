import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Package,
  Barcode,
  Upload,
  ClipboardList,
  Search,
  AlertCircle,
  CheckCircle,
  Filter,
  X,
  RefreshCw,
  Lock,
  Download,
  LogOut,
  FileSpreadsheet,
  Eye,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  onSnapshot,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

// ==================================================================================
// --- ÁREA DE CONFIGURAÇÃO ---
// ==================================================================================

// 1. LINK DA SUA PLANILHA (Publicada como XLSX)
const DEFAULT_XLSX_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRseAVjs6VEwSUFJJOSnBgXS5ssRC9oT5Yl-TZ6vSILaG7JKQnFT9YG1yBryVBDGBzbnXATtn4ot0-F/pub?output=xlsx";

// 2. SENHA DE ACESSO AO SISTEMA
const MASTER_PIN = "1234";

// 3. CONFIGURAÇÃO DO FIREBASE (JÁ CONFIGURADO)
const MANUAL_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAhk5a8MdWaqlveF5MM2lv2oAHyUIVMVxY",
  authDomain: "estoque-sempre-joias.firebaseapp.com",
  projectId: "estoque-sempre-joias",
  storageBucket: "estoque-sempre-joias.firebasestorage.app",
  messagingSenderId: "1015159286438",
  appId: "1:1015159286438:web:3d02de1106cf4d4e7fe267",
};

// ==================================================================================

const STORAGE_KEY = "estoque_catalog_cache";

export default function InventorySystem() {
  // --- AUTH STATES ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [loginError, setLoginError] = useState(false);

  // --- APP STATES ---
  const [activeTab, setActiveTab] = useState("conference");
  const [catalog, setCatalog] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSource, setCatalogSource] = useState("none");

  // --- ESTADOS DE VISUALIZAÇÃO ---
  const [sortConfig, setSortConfig] = useState({
    key: "quantity",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [zoomedImage, setZoomedImage] = useState(null);

  // Firebase
  const [user, setUser] = useState(null);
  const [appId, setAppId] = useState("default-app-id");
  const [db, setDb] = useState(null);

  // Inputs
  const [barcodeInput, setBarcodeInput] = useState("");
  const [salesInput, setSalesInput] = useState("");
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterModel, setFilterModel] = useState("all");

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- 0. CARREGAR DEPENDÊNCIAS EXTERNAS (TAILWIND + XLSX) ---
  useEffect(() => {
    // 1. Injeta o Tailwind CSS (Deixa o app bonito)
    const styleScript = document.createElement("script");
    styleScript.src = "https://cdn.tailwindcss.com";
    document.head.appendChild(styleScript);

    // 2. Injeta a biblioteca XLSX (Lê o Excel)
    if (!window.XLSX) {
      const xlsxScript = document.createElement("script");
      xlsxScript.src =
        "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      xlsxScript.async = true;
      document.body.appendChild(xlsxScript);

      // Cleanup ao fechar
      return () => {
        try {
          document.head.removeChild(styleScript);
          document.body.removeChild(xlsxScript);
        } catch (e) {}
      };
    }
  }, []);

  // --- 1. FIREBASE INIT ---
  useEffect(() => {
    const configToUse =
      MANUAL_FIREBASE_CONFIG ||
      (typeof __firebase_config !== "undefined"
        ? JSON.parse(__firebase_config)
        : null);

    if (!configToUse || !configToUse.apiKey) {
      console.warn("Firebase não configurado.");
      return;
    }

    try {
      const app = initializeApp(configToUse);
      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);
      setDb(dbInstance);

      const currentAppId =
        typeof __app_id !== "undefined" ? __app_id : "estoque-oficial";
      setAppId(currentAppId);

      const initAuth = async () => {
        try {
          if (
            typeof __initial_auth_token !== "undefined" &&
            __initial_auth_token
          ) {
            const { signInWithCustomToken } = await import("firebase/auth");
            await signInWithCustomToken(authInstance, __initial_auth_token);
          } else {
            await signInAnonymously(authInstance);
          }
        } catch (e) {
          console.error("Auth Error:", e);
          await signInAnonymously(authInstance);
        }
      };
      initAuth();

      const unsubscribe = onAuthStateChanged(authInstance, (u) => setUser(u));
      return () => unsubscribe();
    } catch (err) {
      console.error("Erro ao inicializar Firebase:", err);
    }
  }, []);

  // --- 2. PROCESSAMENTO DE DADOS ---
  const processCatalogData = (rows) => {
    if (!rows || rows.length === 0) return [];
    const headers = rows[0].map((h) => String(h).trim().toLowerCase());

    let skuIdx = headers.indexOf("sku");
    let nameIdx = headers.indexOf("name");
    let modelIdx = headers.indexOf("model");
    let imageIdx = headers.indexOf("images");
    let priceIdx = headers.indexOf("price");

    if (skuIdx === -1) skuIdx = 3;
    if (nameIdx === -1) nameIdx = 4;
    if (modelIdx === -1) modelIdx = 5;
    if (imageIdx === -1) imageIdx = 15;
    if (priceIdx === -1) priceIdx = 16;

    const products = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length <= skuIdx) continue;

      const rawSku = row[skuIdx];
      if (!rawSku) continue;
      const sku = String(rawSku).trim().toUpperCase();
      if (sku.length < 2) continue;

      let finalImage = null;
      const rawImage = row[imageIdx];

      if (rawImage) {
        const imgStr = String(rawImage).trim();
        if (imgStr.startsWith("[")) {
          try {
            const jsonStr = imgStr.replace(/\\'/g, "'");
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].url) {
              finalImage = parsed[0].url.replace(/\\\//g, "/");
            }
          } catch (e) {
            const urlMatch = imgStr.match(/https?:[^" ]+\.(?:jpg|png|jpeg)/i);
            if (urlMatch) finalImage = urlMatch[0].replace(/\\\//g, "/");
          }
        } else if (imgStr.startsWith("http")) {
          finalImage = imgStr;
        }
      }

      let finalPrice = 0;
      const rawPrice = row[priceIdx];
      if (rawPrice !== undefined && rawPrice !== null) {
        if (typeof rawPrice === "number") {
          finalPrice = rawPrice;
        } else {
          let pStr = String(rawPrice).replace(/[R$\s]/g, "");
          if (pStr.includes(",") && !pStr.includes(".")) {
            pStr = pStr.replace(",", ".");
          } else if (pStr.includes(".") && pStr.includes(",")) {
            pStr = pStr.replace(/\./g, "").replace(",", ".");
          }
          finalPrice = parseFloat(pStr) || 0;
        }
      }

      products.push({
        sku: sku,
        name: row[nameIdx] || "Sem Nome",
        model: row[modelIdx] || "-",
        price: finalPrice,
        image: finalImage,
      });
    }
    return products;
  };

  // --- 3. FETCHERS ---
  const saveToCache = (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  };

  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        setCatalog(parsed);
        setCatalogSource("cache");
        return true;
      }
    } catch (e) {}
    return false;
  };

  const parseWorkbook = (data) => {
    if (!window.XLSX) throw new Error("Biblioteca XLSX não carregada.");
    const workbook = window.XLSX.read(data, { type: "array" });
    let targetSheetName = workbook.SheetNames[0];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const headers = window.XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        range: 0,
        limit: 1,
      })[0];
      if (
        headers &&
        headers.some((h) => String(h).toLowerCase().includes("sku"))
      ) {
        targetSheetName = sheetName;
        break;
      }
    }
    const worksheet = workbook.Sheets[targetSheetName];
    const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    return processCatalogData(jsonData);
  };

  const fetchCatalogXLSX = async () => {
    setLoadingCatalog(true);
    try {
      const response = await fetch(DEFAULT_XLSX_URL);
      if (!response.ok) throw new Error("Erro ao baixar XLSX");
      const arrayBuffer = await response.arrayBuffer();
      const processed = parseWorkbook(arrayBuffer);
      setCatalog(processed);
      setCatalogSource("web");
      saveToCache(processed);
      if (isAuthenticated)
        showNotification(
          `Conectado! ${processed.length} produtos carregados.`,
          "success"
        );
    } catch (error) {
      console.warn("XLSX Fetch Error:", error);
      const loaded = loadFromCache();
      if (!loaded && isAuthenticated)
        showNotification("Falha na conexão. Importe manualmente.", "error");
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    if (file.name.endsWith(".csv")) {
      reader.onload = (evt) => {
        if (window.XLSX) {
          const workbook = window.XLSX.read(evt.target.result, {
            type: "string",
          });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
          const processed = processCatalogData(json);
          setCatalog(processed);
          setCatalogSource("file");
          saveToCache(processed);
          showNotification(`CSV: ${processed.length} itens.`, "success");
        }
      };
      reader.readAsText(file);
    } else {
      reader.onload = (evt) => {
        try {
          const processed = parseWorkbook(evt.target.result);
          setCatalog(processed);
          setCatalogSource("file");
          saveToCache(processed);
          showNotification(`Excel: ${processed.length} itens.`, "success");
        } catch (err) {
          showNotification("Erro ao ler Excel.", "error");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Tenta carregar dados ao iniciar (se já tiver login)
  useEffect(() => {
    const checkXLSX = setInterval(() => {
      if (window.XLSX && isAuthenticated) {
        fetchCatalogXLSX();
        clearInterval(checkXLSX);
      }
    }, 500);
    return () => clearInterval(checkXLSX);
  }, [isAuthenticated]);

  // --- SYNC REALTIME ---
  useEffect(() => {
    if (!user || !db) return;
    const q = query(
      collection(db, "artifacts", appId, "public", "data", "inventory_items"),
      orderBy("timestamp", "desc")
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setInventory(items);
      },
      (error) => console.error("Erro DB:", error)
    );
    return () => unsubscribe();
  }, [user, db, appId]);

  // --- HELPERS ---
  const findCatalogItem = (scannedSku) => {
    if (!scannedSku) return null;
    const cleanSku = scannedSku.toUpperCase().trim();
    const exactMatch = catalog.find((p) => p.sku === cleanSku);
    if (exactMatch)
      return { ...exactMatch, matchType: "exact", baseSku: exactMatch.sku };
    const parts = cleanSku.split("-");
    if (parts.length > 1) {
      for (let i = parts.length - 1; i >= 1; i--) {
        const potentialParentSku = parts.slice(0, i).join("-");
        const parentMatch = catalog.find((p) => p.sku === potentialParentSku);
        if (parentMatch)
          return {
            ...parentMatch,
            matchType: "parent",
            baseSku: potentialParentSku,
            variationSku: cleanSku,
          };
      }
    }
    if (cleanSku.length > 5) {
      const prefixMatch = catalog.find(
        (p) => cleanSku.startsWith(p.sku) && p.sku.length > 4
      );
      if (prefixMatch)
        return {
          ...prefixMatch,
          matchType: "parent_prefix",
          baseSku: prefixMatch.sku,
          variationSku: cleanSku,
        };
    }
    return null;
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (pinInput === MASTER_PIN) {
      setIsAuthenticated(true);
      setLoginError(false);
      if (catalog.length === 0 && window.XLSX) fetchCatalogXLSX();
    } else {
      setLoginError(true);
      setPinInput("");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPinInput("");
  };

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- ORDENAÇÃO E PAGINAÇÃO ---
  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // --- AÇÕES ---
  const handleScan = async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const sku = barcodeInput.trim().toUpperCase();
      if (!sku) return;
      if (!db || !user) {
        showNotification("Offline.", "error");
        return;
      }

      const catalogInfo = findCatalogItem(sku);
      try {
        await addDoc(
          collection(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "inventory_items"
          ),
          {
            sku,
            baseSku: catalogInfo ? catalogInfo.sku : null,
            status: "in_stock",
            timestamp: serverTimestamp(),
            dateIn: new Date().toLocaleString("pt-BR"),
            dateOut: null,
          }
        );
        showNotification(
          catalogInfo ? `+1 ${catalogInfo.name}` : `+1 SKU: ${sku}`,
          "success"
        );
      } catch (err) {
        showNotification(`Erro: ${err.message}`, "error");
      }
      setBarcodeInput("");
    }
  };

  const processSales = async () => {
    const lines = salesInput
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "");
    if (lines.length === 0) return;
    if (!db) return;

    const batch = writeBatch(db);
    let batchCount = 0;
    let tempInventory = [...inventory];

    for (const line of lines) {
      const skuToSell = line.trim().toUpperCase();
      const itemIndex = tempInventory.findIndex(
        (i) => i.sku === skuToSell && i.status === "in_stock"
      );

      if (itemIndex !== -1) {
        const item = tempInventory[itemIndex];
        const itemRef = doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "inventory_items",
          item.id
        );
        batch.update(itemRef, {
          status: "sold",
          dateOut: new Date().toLocaleString("pt-BR"),
          soldTimestamp: serverTimestamp(),
        });
        tempInventory.splice(itemIndex, 1);
        batchCount++;
      }
    }
    if (batchCount > 0) {
      await batch.commit();
      showNotification(`${batchCount} baixados!`, "success");
      setSalesInput("");
    } else {
      showNotification("Nenhum item em estoque.", "warning");
    }
  };

  const handleExportCSV = () => {
    if (inventory.length === 0) {
      showNotification("Vazio.", "warning");
      return;
    }
    const headers = [
      "SKU",
      "Produto Base",
      "Nome",
      "Modelo",
      "Status",
      "Data Entrada",
      "Preço",
    ];
    const rows = inventory.map((item) => {
      const details = findCatalogItem(item.sku);
      return [
        item.sku,
        details ? details.sku : "-",
        details ? `"${details.name}"` : "-",
        details ? details.model : "-",
        item.status === "in_stock" ? "Em Estoque" : "Vendido",
        item.dateIn,
        details ? `"${details.price.toFixed(2).replace(".", ",")}"` : "0,00",
      ].join(";");
    });
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(";"), ...rows].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `estoque.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- AGRUPAMENTO, FILTRO, ORDENAÇÃO, PAGINAÇÃO ---
  const groupedInventory = useMemo(() => {
    const groups = {};
    inventory.forEach((item) => {
      if (item.status !== "in_stock") return;
      const sku = item.sku;
      if (!groups[sku]) {
        const details = findCatalogItem(sku);
        groups[sku] = {
          sku: sku,
          baseSku: details ? details.sku : "-",
          name: details ? details.name : "Produto Não Identificado",
          model: details ? details.model : "-",
          image: details ? details.image : null,
          price: details ? details.price : 0,
          quantity: 0,
        };
      }
      groups[sku].quantity += 1;
    });
    return Object.values(groups);
  }, [inventory, catalog]);

  const filteredAndSortedGroups = useMemo(() => {
    // 1. Filtrar
    let result = groupedInventory.filter((group) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        group.sku.toLowerCase().includes(searchLower) ||
        group.name.toLowerCase().includes(searchLower) ||
        group.baseSku.toLowerCase().includes(searchLower) ||
        group.model.toLowerCase().includes(searchLower);
      const matchesModel = filterModel === "all" || group.model === filterModel;
      return matchesSearch && matchesModel;
    });

    // 2. Ordenar
    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [groupedInventory, searchTerm, filterModel, sortConfig]);

  // 3. Paginação
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedGroups.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedGroups, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedGroups.length / itemsPerPage);

  const uniqueModels = useMemo(() => {
    const models = new Set();
    catalog.forEach((item) => {
      if (item.model && item.model !== "-") models.add(item.model);
    });
    return Array.from(models).sort();
  }, [catalog]);

  const totalItems = inventory.filter((i) => i.status === "in_stock").length;
  const totalValue = groupedInventory.reduce(
    (acc, group) => acc + group.price * group.quantity,
    0
  );

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) return <div className="w-4 h-4" />;
    return sortConfig.direction === "asc" ? (
      <ChevronUp size={14} />
    ) : (
      <ChevronDown size={14} />
    );
  };

  // --- RENDER ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={40} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            Acesso Restrito
          </h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="PIN"
              className="w-full text-center text-3xl tracking-[1em] font-mono p-4 border-2 rounded-xl outline-none"
              maxLength={4}
              autoFocus
            />
            {loginError && (
              <p className="text-red-500 text-sm">PIN Incorreto.</p>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl"
            >
              ENTRAR
            </button>
          </form>
          <p className="mt-8 text-xs text-slate-400">Dica: 1234</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans relative">
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white p-2 rounded-lg shadow-2xl">
            <button
              className="absolute -top-4 -right-4 bg-red-600 text-white p-2 rounded-full shadow-lg hover:bg-red-700"
              onClick={() => setZoomedImage(null)}
            >
              <X size={24} />
            </button>
            <img
              src={zoomedImage}
              alt="Zoom"
              className="max-w-full max-h-[85vh] object-contain rounded"
            />
          </div>
        </div>
      )}

      <header className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Package size={24} />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Estoque Cloud</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  {loadingCatalog
                    ? "Baixando Excel..."
                    : `Catálogo: ${catalog.length} itens`}
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold border ${
                      catalogSource === "web"
                        ? "bg-green-100 text-green-700 border-green-200"
                        : catalogSource === "cache"
                        ? "bg-amber-100 text-amber-700 border-amber-200"
                        : catalogSource === "file"
                        ? "bg-blue-100 text-blue-700 border-blue-200"
                        : "bg-red-100 text-red-700 border-red-200"
                    }`}
                  >
                    {catalogSource === "web"
                      ? "XLSX Cloud"
                      : catalogSource === "cache"
                      ? "Memória"
                      : catalogSource === "file"
                      ? "Arquivo"
                      : "Vazio"}
                  </span>
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv, .xlsx, .xls"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded flex items-center gap-1 transition-colors border border-slate-700"
                >
                  <FileSpreadsheet size={10} /> Importar
                </button>
              </div>
            </div>
            <button onClick={handleLogout} className="md:hidden text-slate-400">
              <LogOut size={20} />
            </button>
          </div>
          <div className="flex gap-4 text-sm w-full md:w-auto items-center justify-end">
            <div className="bg-slate-800 px-4 py-2 rounded-lg text-center">
              <span className="block text-xs text-slate-400 uppercase">
                Qtd Peças
              </span>
              <span className="text-lg font-bold text-green-400">
                {totalItems}
              </span>
            </div>
            <div className="bg-slate-800 px-4 py-2 rounded-lg text-center hidden sm:block">
              <span className="block text-xs text-slate-400 uppercase">
                Valor Total
              </span>
              <span className="text-lg font-bold text-blue-400">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                }).format(totalValue)}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="hidden md:block text-slate-400 hover:text-white ml-2"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b sticky top-[80px] z-10 shadow-sm">
        <div className="max-w-6xl mx-auto flex overflow-x-auto">
          <button
            onClick={() => setActiveTab("conference")}
            className={`flex-1 min-w-[100px] py-4 font-medium text-xs md:text-sm flex flex-col md:flex-row items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === "conference"
                ? "border-blue-600 text-blue-600 bg-blue-50"
                : "border-transparent text-slate-500"
            }`}
          >
            <Barcode size={18} /> CONFERÊNCIA
          </button>
          <button
            onClick={() => setActiveTab("stock")}
            className={`flex-1 min-w-[100px] py-4 font-medium text-xs md:text-sm flex flex-col md:flex-row items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === "stock"
                ? "border-blue-600 text-blue-600 bg-blue-50"
                : "border-transparent text-slate-500"
            }`}
          >
            <ClipboardList size={18} /> ESTOQUE
          </button>
          <button
            onClick={() => setActiveTab("sales")}
            className={`flex-1 min-w-[100px] py-4 font-medium text-xs md:text-sm flex flex-col md:flex-row items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === "sales"
                ? "border-blue-600 text-blue-600 bg-blue-50"
                : "border-transparent text-slate-500"
            }`}
          >
            <Upload size={18} /> BAIXA
          </button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-4 md:p-6 pb-20">
        {notification && (
          <div
            className={`fixed top-24 right-4 z-50 p-4 rounded-lg shadow-xl text-white animate-slide-in flex items-center gap-3 max-w-sm ${
              notification.type === "error" ? "bg-red-500" : "bg-emerald-600"
            }`}
          >
            {notification.type === "error" ? (
              <AlertCircle size={24} />
            ) : (
              <CheckCircle size={24} />
            )}
            <span className="font-medium text-sm">{notification.message}</span>
          </div>
        )}

        {/* --- CONFERENCIA --- */}
        {activeTab === "conference" && (
          <div className="flex flex-col items-center justify-center py-6 md:py-12">
            <div className="w-full max-w-lg bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-purple-500"></div>
              <div className="mb-6">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                  <Barcode size={32} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Leitor Ativo
                </h2>
                <p className="text-slate-500 mt-2 text-sm">
                  Bipe para adicionar (Multiplicidade Permitida)
                </p>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleScan}
                disabled={!db}
                className="w-full h-16 px-6 text-3xl font-mono text-center border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all uppercase placeholder:text-slate-300 disabled:bg-slate-100"
                placeholder={db ? "BIPAR..." : "..."}
              />
            </div>

            <div className="w-full max-w-2xl mt-8 space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
                Últimos Lidos (Log)
              </h3>
              {inventory.slice(0, 5).map((item, idx) => {
                const details = findCatalogItem(item.sku);
                return (
                  <div
                    key={item.id || idx}
                    className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-slate-100">
                      {details?.image ? (
                        <img
                          src={details.image}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package size={20} className="text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-600 text-sm">
                          {item.sku}
                        </span>
                        {item.status !== "in_stock" && (
                          <span className="text-[9px] bg-red-100 text-red-700 px-1 rounded">
                            VENDIDO
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 truncate">
                        {details?.name || "Item não identificado"}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {item.dateIn.split(" ")[1]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- ESTOQUE (AGRUPADO) --- */}
        {activeTab === "stock" && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchCatalogXLSX}
                  disabled={loadingCatalog}
                  className="p-2.5 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  <RefreshCw
                    size={20}
                    className={loadingCatalog ? "animate-spin" : ""}
                  />
                </button>
                <button
                  onClick={handleExportCSV}
                  className="p-2.5 border border-slate-300 rounded-lg hover:bg-green-50 text-green-600"
                >
                  <Download size={20} />
                </button>
                <div className="relative w-48">
                  <Filter
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <select
                    className="w-full pl-9 pr-8 py-2.5 border border-slate-300 rounded-lg outline-none bg-white text-sm appearance-none"
                    value={filterModel}
                    onChange={(e) => {
                      setFilterModel(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="all">Todos Modelos</option>
                    {uniqueModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50">
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 font-bold tracking-wider">
                      <th className="px-4 py-3 w-16">Foto</th>
                      <th
                        className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => requestSort("sku")}
                      >
                        <div className="flex items-center gap-1">
                          SKU <SortIcon colKey="sku" />
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => requestSort("name")}
                      >
                        <div className="flex items-center gap-1">
                          Nome <SortIcon colKey="name" />
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => requestSort("model")}
                      >
                        <div className="flex items-center gap-1">
                          Modelo <SortIcon colKey="model" />
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => requestSort("quantity")}
                      >
                        <div className="flex items-center gap-1 justify-end">
                          Qtd <SortIcon colKey="quantity" />
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => requestSort("price")}
                      >
                        <div className="flex items-center gap-1 justify-end">
                          Preço <SortIcon colKey="price" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedData.map((group, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30">
                        <td className="px-4 py-3">
                          <div
                            className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer group relative"
                            onClick={() =>
                              group.image && setZoomedImage(group.image)
                            }
                          >
                            {group.image ? (
                              <>
                                <img
                                  src={group.image}
                                  alt=""
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-all">
                                  <Eye
                                    size={12}
                                    className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md"
                                  />
                                </div>
                              </>
                            ) : (
                              <Package size={16} className="text-slate-300" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-blue-600 text-xs">
                            {group.sku}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-slate-700 text-xs md:text-sm font-medium line-clamp-1"
                            title={group.name}
                          >
                            {group.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {group.baseSku}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-600">
                            {group.model}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold bg-green-100 text-green-800">
                            {group.quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs text-slate-500">
                            {group.price
                              ? `R$ ${group.price.toFixed(2).replace(".", ",")}`
                              : "-"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredAndSortedGroups.length === 0 && (
                      <tr>
                        <td
                          colSpan="7"
                          className="px-6 py-8 text-center text-slate-400"
                        >
                          Nenhum item encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINAÇÃO */}
              {totalPages > 1 && (
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
                    {Math.min(
                      currentPage * itemsPerPage,
                      filteredAndSortedGroups.length
                    )}{" "}
                    de {filteredAndSortedGroups.length} resultados
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="flex items-center px-2 font-medium bg-white border border-slate-300 rounded">
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- SALES --- */}
        {activeTab === "sales" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold mb-4">Baixa em Massa</h2>
            <textarea
              value={salesInput}
              onChange={(e) => setSalesInput(e.target.value)}
              placeholder={`Cole SKUs aqui...\nDIR-NAV-Z-16\n...`}
              className="w-full p-4 border rounded-xl font-mono text-sm h-48 mb-4 bg-slate-50"
            />
            <button
              onClick={processSales}
              disabled={!salesInput}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-bold"
            >
              BAIXAR ITENS
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
