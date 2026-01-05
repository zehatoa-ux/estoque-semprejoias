import { useState, useEffect, useMemo, useCallback } from "react";
import { DEFAULT_XLSX_URL, STORAGE_KEY } from "../config/constants";

export function useCatalog(user) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState("none"); // 'web' | 'cache' | 'none'

  // --- 1. LÓGICA DE PARSE (Interna) ---
  const processCatalogData = (rows) => {
    if (!rows || rows.length === 0) return [];
    const headers = rows[0].map((h) => String(h).trim().toLowerCase());

    // Mapeamento de colunas
    let skuIdx = headers.indexOf("sku");
    if (skuIdx === -1) skuIdx = 3;
    let nameIdx = headers.indexOf("name");
    if (nameIdx === -1) nameIdx = 4;
    let modelIdx = headers.indexOf("model");
    if (modelIdx === -1) modelIdx = 5;
    let imageIdx = headers.indexOf("images");
    if (imageIdx === -1) imageIdx = 15;
    let priceIdx = headers.indexOf("price");
    if (priceIdx === -1) priceIdx = 16;
    let tagsIdx = headers.indexOf("tags");
    if (tagsIdx === -1) tagsIdx = headers.indexOf("tag");

    const products = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length <= skuIdx) continue;

      const sku = String(row[skuIdx]).trim().toUpperCase();
      if (sku.length < 2) continue;

      // Tratamento de Imagem
      let finalImage = null;
      const rawImage = row[imageIdx];
      if (rawImage) {
        const imgStr = String(rawImage).trim();
        if (imgStr.startsWith("[")) {
          try {
            const parsed = JSON.parse(imgStr.replace(/\\'/g, "'"));
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].url)
              finalImage = parsed[0].url.replace(/\\\//g, "/");
          } catch (e) {
            const urlMatch = imgStr.match(/https?:[^" ]+\.(?:jpg|png|jpeg)/i);
            if (urlMatch) finalImage = urlMatch[0].replace(/\\\//g, "/");
          }
        } else if (imgStr.startsWith("http")) finalImage = imgStr;
      }

      // Tratamento de Preço
      let finalPrice = 0;
      const rawPrice = row[priceIdx];
      if (rawPrice !== undefined && rawPrice !== null) {
        if (typeof rawPrice === "number") finalPrice = rawPrice;
        else {
          let pStr = String(rawPrice).replace(/[R$\s]/g, "");
          if (pStr.includes(",") && !pStr.includes("."))
            pStr = pStr.replace(",", ".");
          else if (pStr.includes(".") && pStr.includes(","))
            pStr = pStr.replace(/\./g, "").replace(",", ".");
          finalPrice = parseFloat(pStr) || 0;
        }
      }

      products.push({
        sku,
        name: row[nameIdx] || "Sem Nome",
        model: row[modelIdx] || "-",
        price: finalPrice,
        image: finalImage,
        tags: tagsIdx !== -1 ? row[tagsIdx] : "[]",
      });
    }
    return products;
  };

  const parseWorkbook = (data) => {
    if (!window.XLSX) throw new Error("Biblioteca XLSX não carregada.");
    const workbook = window.XLSX.read(data, { type: "array" });
    let targetSheetName = workbook.SheetNames[0];

    // Procura a aba certa
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
    return processCatalogData(
      window.XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    );
  };

  // --- 2. PERSISTÊNCIA (Cache) ---
  const saveToCache = (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  };

  const loadFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        setCatalog(JSON.parse(cached));
        setSource("cache");
        return true;
      }
    } catch (e) {}
    return false;
  }, []);

  // --- 3. FETCH (Rede) ---
  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(DEFAULT_XLSX_URL);
      if (!response.ok) throw new Error("Erro ao baixar XLSX");
      const arrayBuffer = await response.arrayBuffer();
      const processed = parseWorkbook(arrayBuffer);
      setCatalog(processed);
      setSource("web");
      saveToCache(processed);
      return { success: true, count: processed.length };
    } catch (error) {
      console.error(error);
      const loaded = loadFromCache();
      return { success: false, usedCache: loaded };
    } finally {
      setLoading(false);
    }
  }, [loadFromCache]);

  // --- 4. INICIALIZAÇÃO ---
  // Tenta carregar assim que o usuário logar e o script XLSX estiver pronto
  useEffect(() => {
    const i = setInterval(() => {
      // Só carrega se tiver usuário, tiver script e o catálogo estiver vazio
      if (window.XLSX && user && catalog.length === 0) {
        fetchCatalog();
        clearInterval(i);
      }
    }, 1000); // Verificação a cada 1s
    return () => clearInterval(i);
  }, [user, catalog.length, fetchCatalog]);

  // --- 5. BUSCA INTELIGENTE (findItem) ---

  // Otimização: Mapa para busca O(1)
  const catalogMap = useMemo(() => {
    const map = new Map();
    catalog.forEach((item) => {
      map.set(item.sku, item);
    });
    return map;
  }, [catalog]);

  // A função principal que o App.js usa
  const findItem = useCallback(
    (sku) => {
      if (!sku) return null;
      const s = String(sku).toUpperCase().trim();

      // 1. Tenta exato
      if (catalogMap.has(s)) return { ...catalogMap.get(s), baseSku: s };

      // 2. Tenta hierarquia (SKU pai)
      const parts = s.split("-");
      if (parts.length > 1) {
        for (let i = parts.length - 1; i >= 1; i--) {
          const potentialParentSku = parts.slice(0, i).join("-");
          if (catalogMap.has(potentialParentSku))
            return {
              ...catalogMap.get(potentialParentSku),
              baseSku: potentialParentSku,
            };
        }
      }

      // 3. Fallback
      return {
        sku: s,
        name: "Item não catalogado",
        price: 0,
        model: "-",
        image: null,
      };
    },
    [catalogMap]
  );

  return {
    catalog,
    loading,
    source,
    findItem,
    refreshCatalog: fetchCatalog, // Expõe função para botão de recarregar
  };
}
