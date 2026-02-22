import React, { useEffect, useState, useRef } from "react";
import { FaPlus, FaTrash, FaEdit, FaFileExcel, FaFileCsv, FaUpload, FaFilePdf, FaExclamationTriangle, FaCheck, FaCopy } from "react-icons/fa";
import { listDivisions, listItems } from "../api/items";
import { listOrganizations, listRegions } from "../api/orgs";
import {
  listEstimationLines,
  createEstimationLine,
  updateEstimationLine,
  deleteEstimationLines,
  getEstimationTotal,
  getEstimation,
  listSpecialItemRequests,
  approveSpecialItemRequest,
  rejectSpecialItemRequest,
  createSpecialItemRequest,
  updateSpecialItemRequest,
  deleteSpecialItemRequest,
} from "../api/estimations";
import { useParams, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "../hooks/useAuth.js";

const parseDimensionInput = (raw) => {
  const text = String(raw ?? "").trim();
  if (!text) return { value: null, expr: null, error: null };
  
  // Normalize unicode fractions and common math symbols
  let cleaned = text.replace(/\s+/g, "");
  
  // Replace common multiplication symbols
  cleaned = cleaned.replace(/[xX×]/g, "*");

  cleaned = cleaned.replace(/½/g, "(1/2)")
                   .replace(/⅓/g, "(1/3)")
                   .replace(/⅔/g, "(2/3)")
                   .replace(/¼/g, "(1/4)")
                   .replace(/¾/g, "(3/4)")
                   .replace(/⅕/g, "(1/5)")
                   .replace(/⅖/g, "(2/5)")
                   .replace(/⅗/g, "(3/5)")
                   .replace(/⅘/g, "(4/5)")
                   .replace(/⅙/g, "(1/6)")
                   .replace(/⅚/g, "(5/6)")
                   .replace(/⅛/g, "(1/8)")
                   .replace(/⅜/g, "(3/8)")
                   .replace(/⅝/g, "(5/8)")
                   .replace(/⅞/g, "(7/8)");

  // Insert explicit multiplication for implicit cases:
  // 1. digit/parenthesis followed by parenthesis: 2(3) -> 2*(3), (2)(3) -> (2)*(3)
  // 2. parenthesis followed by digit: (2)3 -> (2)*3
  // Repeatedly apply to handle nested/chained cases correctly
  cleaned = cleaned.replace(/(\d|\))(?=\()/g, "$1*");
  cleaned = cleaned.replace(/(\))(?=\d)/g, "$1*");

  const hasOperator = /[+\-*/()]/.test(cleaned);
  const isNumber = /^-?(?:\d+(\.\d+)?|\.\d+)$/.test(cleaned);
  
  if (isNumber) return { value: Number(cleaned), expr: hasOperator ? text : null, error: null };
  
  // Allow numbers, standard operators, and parentheses
  if (!/^[0-9+\-*/().]+$/.test(cleaned) || cleaned.includes("..")) {
    return { value: null, expr: null, error: "Invalid expression" };
  }
  
  try {
    const result = Function(`"use strict"; return (${cleaned})`)();
    if (!Number.isFinite(result)) return { value: null, expr: null, error: "Invalid expression" };
    // Return original text as expression to preserve user formatting, unless it was just a number
    return { value: Number(result), expr: text, error: null };
  } catch {
    return { value: null, expr: null, error: "Invalid expression" };
  }
};

const getInitialDimensionValue = (expr, value) => {
  if (expr !== null && expr !== undefined && String(expr).trim() !== "") return expr;
  if (value === null || value === undefined) return "";
  return value;
};

export default function EstimationDetail() {
  const { estimationId } = useParams();
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole("admin") || hasRole("superadmin");
  const [estimation, setEstimation] = useState(null);
  const isOwner = estimation?.created_by_id === user?.user_id;
  const canEdit = isAdmin || isOwner;
  const [searchParams, setSearchParams] = useSearchParams();
  const [lines, setLines] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [specialRequests, setSpecialRequests] = useState([]);
  const [specialRequestsLoading, setSpecialRequestsLoading] = useState(false);
  const [specialRequestsError, setSpecialRequestsError] = useState("");
  const [selectedLineIds, setSelectedLineIds] = useState([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddLineModalOpen, setIsAddLineModalOpen] = useState(false);
  const [isDeleteLinesModalOpen, setIsDeleteLinesModalOpen] = useState(false);
  const [isLineDetailOpen, setIsLineDetailOpen] = useState(false);
  const [lineDetail, setLineDetail] = useState(null);
  const [editingLine, setEditingLine] = useState(null);
  const [region, setRegion] = useState("");
  const [availableRegions, setAvailableRegions] = useState([]);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const formatAmount = (n) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importError, setImportError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0); // 0-100
  const [importMode, setImportMode] = useState("append");
  const [importBanner, setImportBanner] = useState(null); // { type: 'success'|'warning'|'error', message: string }
  const downloadMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isImportDragging, setIsImportDragging] = useState(false);
  const [equationView, setEquationView] = useState({});
  const [isEditingEnabled, setIsEditingEnabled] = useState(false);
  const [inlineEditingCell, setInlineEditingCell] = useState(null); // { lineId, field }
  const [inlineValue, setInlineValue] = useState("");
  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      const saved = localStorage.getItem("estimationColumnWidths");
      return saved ? JSON.parse(saved) : { item_code: 150, description: 250, sub_description: 150 };
    } catch {
      return { item_code: 150, description: 250, sub_description: 150 };
    }
  });
  
  useEffect(() => {
    try {
      localStorage.setItem("estimationColumnWidths", JSON.stringify(columnWidths));
    } catch {}
  }, [columnWidths]);

  const resizingRef = useRef(null); // { column, startX, startWidth }

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingRef.current) return;
      const { column, startX, startWidth } = resizingRef.current;
      const diff = e.clientX - startX;
      setColumnWidths(prev => ({
        ...prev,
        [column]: Math.max(50, startWidth + diff)
      }));
    };

    const handleMouseUp = () => {
      if (resizingRef.current) {
        resizingRef.current = null;
        document.body.style.cursor = 'default';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResizing = (e, column) => {
    e.preventDefault();
    resizingRef.current = {
      column,
      startX: e.clientX,
      startWidth: columnWidths[column]
    };
    document.body.style.cursor = 'col-resize';
  };

  const uniqueItemsByDivision = React.useMemo(() => {
    const map = {}; // divisionId -> { byCode: [], byDesc: [] }
    items.forEach(it => {
        const divId = it.division_id;
        if (!divId) return;
        if (!map[divId]) {
            map[divId] = { codes: new Map(), descs: new Map() };
        }
        if (!map[divId].codes.has(it.item_code)) {
            map[divId].codes.set(it.item_code, it);
        }
        if (!map[divId].descs.has(it.item_description)) {
            map[divId].descs.set(it.item_description, it);
        }
    });
    
    // Convert Maps to Arrays
    const result = {};
    Object.keys(map).forEach(divId => {
        result[divId] = {
            byCode: Array.from(map[divId].codes.values()),
            byDesc: Array.from(map[divId].descs.values())
        };
    });
    return result;
  }, [items]);

  const hasDimensions = (l) => {
    const hasVal = (v) => v != null && v !== "";
    const hasExpr = (e) => e && String(e).trim() !== "";
    return hasVal(l.length) || hasExpr(l.length_expr) ||
           hasVal(l.width) || hasExpr(l.width_expr) ||
           hasVal(l.thickness) || hasExpr(l.thickness_expr) ||
           hasExpr(l.no_of_units_expr);
  };

  const handleInlineSave = async () => {
    if (!inlineEditingCell) return;
    const { lineId, field } = inlineEditingCell;
    const line = lines.find(l => l.line_id === lineId);
    if (!line) return;

    let payload = {
        item_id: line.item_id,
        sub_description: line.sub_description,
        no_of_units: line.no_of_units,
        length: line.length,
        width: line.width,
        thickness: line.thickness,
        length_expr: line.length_expr,
        width_expr: line.width_expr,
        thickness_expr: line.thickness_expr,
        quantity: line.quantity,
    };

    let hasChanges = false;

    if (field === 'item_id' || field === 'item_code' || field === 'description') {
        const newItemId = parseInt(inlineValue);
        if (newItemId !== line.item_id) {
            payload.item_id = newItemId;
            hasChanges = true;
        }
    } else if (field === 'sub_description') {
        if (inlineValue !== line.sub_description) {
            payload.sub_description = inlineValue;
            hasChanges = true;
        }
    } else if (['length', 'width', 'thickness', 'no_of_units'].includes(field)) {
        const res = parseDimensionInput(inlineValue);
        if (res.error) { alert(res.error); return; }
        
        const currentVal = line[field];
        const currentExpr = line[`${field}_expr`];
        // Compare loosely or check if result changed
        // If user typed same expression, res.expr == currentExpr
        // If user typed same value, res.value == currentVal
        if (res.value !== currentVal || (res.expr || null) !== (currentExpr || null)) {
            payload[field] = res.value;
            payload[`${field}_expr`] = res.expr;
            hasChanges = true;
        }
    } else if (field === 'quantity') {
        const newQty = parseFloat(inlineValue) || null;
        if (newQty !== line.quantity) {
            payload.quantity = newQty;
            hasChanges = true;
        }
    }

    if (!hasChanges) {
        setInlineEditingCell(null);
        setInlineValue("");
        return;
    }

    try {
        await updateEstimationLine(lineId, payload);
        setInlineEditingCell(null);
        setInlineValue("");
        fetchLines();
    } catch (e) {
        console.error("Failed to save inline edit", e);
        alert("Failed to save: " + (e.response?.data?.detail || e.message));
    }
  };

  const handleInlineKeyDown = (e) => {
    if (e.key === 'Enter') {
        handleInlineSave();
    } else if (e.key === 'Escape') {
        setInlineEditingCell(null);
        setInlineValue("");
    }
  };

  const handleCellDoubleClick = (line, field) => {
    if (!isEditingEnabled) return;
    setInlineEditingCell({ lineId: line.line_id, field });
    
    // For dimensions, we might want the expression if available
    if (['length', 'width', 'thickness', 'no_of_units'].includes(field)) {
       const exprKey = `${field}_expr`;
       const val = line[exprKey] ? line[exprKey] : line[field];
       setInlineValue(val);
    } else if (field === 'item_id') {
       // For item selection, we use item_id as the value
       setInlineValue(line.item_id);
    } else {
       setInlineValue(line[field]);
    }
  };
  const estimationTitle = localStorage.getItem(`estimationName:${estimationId}`) || `Estimation #${estimationId}`;
  const toggleEquationView = (lineId, field) => {
    const key = `${lineId}:${field}`;
    setEquationView(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const renderDimensionCell = (line, field) => {
    // For no_of_units, the expr field is 'no_of_units_expr'
    const exprKey = field === 'no_of_units' ? 'no_of_units_expr' : `${field}_expr`;
    const expr = line?.[exprKey];
    const value = line?.[field];
    if (!expr) return value ?? "";
    const key = `${line.line_id}:${field}`;
    const showExpr = Boolean(equationView[key]);
    const display = showExpr ? expr : (value ?? "");
    return (
      <button
        type="button"
        onClick={() => toggleEquationView(line.line_id, field)}
        className="w-full text-left rounded border border-teal-200 bg-teal-50 text-teal-900 px-2 py-1 text-xs hover:bg-teal-100"
        title={showExpr ? "Show value" : "Show equation"}
      >
        {display}
      </button>
    );
  };

  const submitImportLines = async () => {
    if (!importFile) {
      setImportError('Please select a CSV or XLSX file.');
      return;
    }
    try {
      setIsImporting(true);
      setImportProgress(0);
      const filename = importFile.name || '';
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      if (!['xlsx','xlsm','csv'].includes(ext)) {
        setImportError('Only .xlsx or .csv files are allowed.');
        setIsImporting(false);
        return;
      }
      // Optional replace: clear existing lines
      if (importMode === 'replace' && lines.length) {
        const allIds = lines.map(l => l.line_id);
        await deleteEstimationLines(allIds);
      }
      let wb;
      if (ext === 'csv') {
        const reader = new FileReader();
        const fileText = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsText(importFile);
        });
        wb = XLSX.read(fileText, { type: 'string' });
      } else {
        const reader = new FileReader();
        const fileArrayBuffer = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsArrayBuffer(importFile);
        });
        wb = XLSX.read(fileArrayBuffer, { type: 'array' });
      }
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, raw: false });

      // Helpers: sanitize numbers, detect totals, normalize codes, and robust header mapping
      const parseNum = (val) => {
        if (val === null || val === undefined) return null;
        const s = String(val).trim();
        if (!s || s === '-' ) return null;
        const n = Number(s.replace(/[,\s]/g, ''));
        return isNaN(n) ? null : n;
      };
      const isTotalLikeRow = (row) => {
        return row.some(cell => {
          const t = String(cell || '').toLowerCase();
          return t.includes('total') || t.includes('subtotal');
        });
      };
      const normCode = (code) => String(code || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      // Precompute item maps for matching by code or description
      const byCode = new Map();
      const byDesc = new Map();
      for (const it of items) {
        const k = normCode(it.item_code);
        if (k) byCode.set(k, it);
        const d = String(it.item_description || '').trim().toLowerCase();
        if (d && !byDesc.has(d)) byDesc.set(d, it);
      }
      const findItemForRow = (codeCell, descCell) => {
        const codeTrim = String(codeCell || '').trim();
        if (codeTrim) {
          // Try exact-first, then normalized
          const exact = items.find(it => String(it.item_code).trim() === codeTrim);
          if (exact) return exact;
          const norm = byCode.get(normCode(codeTrim));
          if (norm) return norm;
        }
        const dkey = String(descCell || '').trim().toLowerCase();
        if (dkey) {
          const byd = byDesc.get(dkey);
          if (byd) return byd;
          // Fallback: contains-based unique match
          const cands = items.filter(it => {
            const descr = String(it.item_description || '').trim().toLowerCase();
            return descr.includes(dkey) || dkey.includes(descr);
          });
          if (cands.length === 1) return cands[0];
        }
        return null;
      };

      // Detect header row: look for key columns with common names
      const headerKeywords = {
        item_code: ['item code', 'code', 'itemcode', 'item'],
        description: ['item description', 'description', 'desc'],
        sub_description: ['sub-description', 'sub description', 'sub desc', 'sub'],
        no_of_units: ['no.', 'no', 'units', 'number'],
        length: ['length'],
        width: ['width'],
        thickness: ['thickness'],
        quantity: ['quantity', 'qty'],
      };
      const headerRowIndex = rows.findIndex(r => {
        const cells = r.map(c => String(c || '').trim().toLowerCase());
        const hasItem = cells.some(x => headerKeywords.item_code.includes(x)) || cells.some(x => headerKeywords.description.includes(x));
        const hasDims = cells.some(x => headerKeywords.length.includes(x)) && cells.some(x => headerKeywords.width.includes(x));
        return hasItem && hasDims;
      });
      let colMap = null;
      if (headerRowIndex >= 0) {
        const hdr = rows[headerRowIndex].map(c => String(c || '').trim().toLowerCase());
        const findCol = (keys) => {
          for (let i = 0; i < hdr.length; i++) {
            if (keys.includes(hdr[i])) return i;
          }
          return -1;
        };
        colMap = {
          item_code: findCol(headerKeywords.item_code),
          description: findCol(headerKeywords.description),
          sub_description: findCol(headerKeywords.sub_description),
          no_of_units: findCol(headerKeywords.no_of_units),
          length: findCol(headerKeywords.length),
          width: findCol(headerKeywords.width),
          thickness: findCol(headerKeywords.thickness),
          quantity: findCol(headerKeywords.quantity),
        };
      }

      let importedCount = 0;
      let skippedCount = 0;
      let missingItemCount = 0;
      let apiErrorCount = 0;
      let processedRows = 0;

      // Start parsing below header if found; else scan entire sheet
      const startIdx = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
      const candidateRows = rows.slice(startIdx).filter((row) => {
        if (!row || row.length === 0) return false;
        if (row.length === 1 || isTotalLikeRow(row)) return false;
        return true;
      });
      const totalRows = candidateRows.length || 1;
      let lastItem = null;
      for (let ri = startIdx; ri < rows.length; ri++) {
        const row = rows[ri];
        if (!row || row.length === 0) continue;
        // Skip visible totals or section headers
        if (row.length === 1 || isTotalLikeRow(row)) continue;

        // Read fields either by header map or by fixed positions fallback
        const codeCell = colMap && colMap.item_code >= 0 ? row[colMap.item_code] : row[0];
        const descCell = colMap && colMap.description >= 0 ? row[colMap.description] : row[1];
        const subDescCell = colMap && colMap.sub_description >= 0 ? row[colMap.sub_description] : row[2];
        const noUnitsCell = colMap && colMap.no_of_units >= 0 ? row[colMap.no_of_units] : row[3];
        const lengthCell = colMap && colMap.length >= 0 ? row[colMap.length] : row[4];
        const widthCell = colMap && colMap.width >= 0 ? row[colMap.width] : row[5];
        const thicknessCell = colMap && colMap.thickness >= 0 ? row[colMap.thickness] : row[6];
        const quantityCell = colMap && colMap.quantity >= 0 ? row[colMap.quantity] : row[7];

        // Filter: Ignore rows where No., Length, Width, Thickness, and Quantity are all empty
        const isCellEmpty = (c) => !c || String(c).trim() === '';
        if (isCellEmpty(noUnitsCell) && isCellEmpty(lengthCell) && isCellEmpty(widthCell) && isCellEmpty(thicknessCell) && isCellEmpty(quantityCell)) {
            skippedCount++; processedRows++; setImportProgress(Math.round((processedRows/totalRows)*100)); continue;
        }

        // Find item by code or description, or use lastItem if code/desc are empty
        let item = null;
        const hasIdentity = (String(codeCell || '').trim()) || (String(descCell || '').trim());
        
        if (hasIdentity) {
            item = findItemForRow(codeCell, descCell);
            lastItem = item; // Update lastItem (could be null if invalid code)
        } else {
            // Continuation row
            item = lastItem;
        }

        if (!item) { skippedCount++; missingItemCount++; processedRows++; setImportProgress(Math.round((processedRows/totalRows)*100)); continue; }
        // Skip if item has no valid rate (blank or non-positive)
        const hasRate = Number.isFinite(Number(item.rate)) && Number(item.rate) > 0;
        if (!hasRate) { skippedCount++; processedRows++; setImportProgress(Math.round((processedRows/totalRows)*100)); continue; }

        const lengthRes = parseDimensionInput(lengthCell);
        const widthRes = parseDimensionInput(widthCell);
        const thicknessRes = parseDimensionInput(thicknessCell);
        const noUnitsRes = parseDimensionInput(noUnitsCell);

        const payload = {
          item_id: item.item_id,
          sub_description: String(subDescCell || ''),
          no_of_units: noUnitsRes.value ?? 1,
          no_of_units_expr: noUnitsRes.expr,
          length: lengthRes.value,
          width: widthRes.value,
          thickness: thicknessRes.value,
          length_expr: lengthRes.expr,
          width_expr: widthRes.expr,
          thickness_expr: thicknessRes.expr,
          quantity: parseNum(quantityCell),
        };

        try {
          await createEstimationLine(estimationId, payload);
          importedCount++;
        } catch (e) {
          console.error('Failed to import row', e);
          skippedCount++;
          apiErrorCount++;
        }
        processedRows++;
        setImportProgress(Math.round((processedRows/totalRows)*100));
      }

      await fetchLines();
      setIsImporting(false);
      // Prepare banner and inline message
      if (importedCount === 0) {
        const reason = missingItemCount ? `No matching items found for ${missingItemCount} row(s)` : 'Import encountered errors';
        setImportError(`Could not import any rows. ${reason}.`);
        setImportBanner({ type: 'error', message: `Import failed: ${reason}. Check region selection and item codes/descriptions.` });
      } else {
        const details = skippedCount ? `Imported ${importedCount}, skipped ${skippedCount} (missing items or rate: ${missingItemCount}${apiErrorCount ? `, API errors: ${apiErrorCount}` : ''}).` : `Imported ${importedCount} row(s).`;
        setImportBanner({ type: skippedCount ? 'warning' : 'success', message: details });
        setIsImportModalOpen(false);
        setImportFile(null);
        setImportError("");
        setImportProgress(0);
      }
    } catch (err) {
      console.error('Import failed:', err);
      const msg = err?.response?.data?.detail || 'Import failed. Please check the file format and try again.';
      setImportError(msg);
      setIsImporting(false);
      setImportBanner({ type: 'error', message: msg });
    }
  };

  const handleImportClick = async () => {
    if (!importFile) {
      setImportError('Select a CSV or XLSX file to enable Import.');
      if (fileInputRef.current) fileInputRef.current.click();
      return;
    }
    // Keep modal open and show inline progress; block interactions
    await submitImportLines();
  };

  // Auto-hide banner after a while
  useEffect(() => {
    if (!importBanner) return;
    // Do not auto-hide info banners; hide success/warning after delay
    if (importBanner.type === 'info' || importBanner.type === 'error') return;
    const t = setTimeout(() => setImportBanner(null), 8000);
    return () => clearTimeout(t);
  }, [importBanner]);

  useEffect(() => {
    // Resolve region from URL or localStorage
    const urlRegion = searchParams.get('region') || '';
    const storedRegion = localStorage.getItem(`estimationRegion:${estimationId}`) || '';
    const resolved = urlRegion || storedRegion;
    if (resolved) {
      setRegion(resolved);
      // normalize URL to include region
      if (!urlRegion) setSearchParams({ region: resolved });
    }
    // Fetch all items initially to populate available regions and items list
    fetchItems();
    fetchLines();
    fetchSpecialItemRequests();
    fetchEstimationDetails();
  }, [estimationId]);

  const fetchEstimationDetails = async () => {
    try {
      const data = await getEstimation(estimationId);
      setEstimation(data);
    } catch (err) {
      console.error("Failed to fetch estimation details", err);
    }
  };

  const fetchItems = async (regionFilter) => {
    try {
      // If no regionFilter is provided, fetch ALL items irrespective of current estimation region.
      const fetchAll = typeof regionFilter === 'undefined';
      if (fetchAll) {
        const res = await listItems({ limit: 1000000 });
        const all = res || [];
        const seen = new Set();
        const dedup = all.filter((it) => {
          const key = it.item_id ?? `${it.item_code}:${it.region}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setItems(dedup);
        const uniqueRegs = Array.from(new Set(dedup.map((it) => it.region))).filter(Boolean).sort();
        setAvailableRegions(uniqueRegs);
        return;
      }

      const reg = regionFilter ?? region;
      // Handle common spelling variants for the same zone
      const aliasRegions = (r) => {
        const v = (r || '').trim();
        if (!v) return [null];
        if (v === 'Comilla Zone') return ['Comilla Zone', 'Cumilla Zone'];
        if (v === 'Cumilla Zone') return ['Cumilla Zone', 'Comilla Zone'];
        return [v];
      };

      const regionsToFetch = aliasRegions(reg);

      let all = [];
      for (const r of regionsToFetch) {
        const params = { limit: 1000000 };
        if (r) params.region = r;
        const res = await listItems(params);
        all = all.concat(res || []);
      }

      // Deduplicate items by item_id if present, otherwise by (item_code, region)
      const seen = new Set();
      const dedup = all.filter((it) => {
        const key = it.item_id ?? `${it.item_code}:${it.region}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setItems(dedup);
      const uniqueRegs = Array.from(new Set(dedup.map((it) => it.region))).filter(Boolean).sort();
      setAvailableRegions(uniqueRegs);
    } catch (e) {
      console.error('Failed to fetch items', e);
    }
  };

  const fetchLines = async () => {
    const data = await listEstimationLines(estimationId);
    setLines(data);
    const tot = await getEstimationTotal(estimationId);
    setTotal(tot.grand_total);
  };

  const fetchSpecialItemRequests = async () => {
    try {
      setSpecialRequestsLoading(true);
      setSpecialRequestsError("");
      const data = await listSpecialItemRequests(estimationId);
      setSpecialRequests(data || []);
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to load special item requests";
      setSpecialRequestsError(msg);
    } finally {
      setSpecialRequestsLoading(false);
    }
  };

  const approveSpecialRequest = async (requestId) => {
    await approveSpecialItemRequest(requestId);
    fetchSpecialItemRequests();
    fetchLines();
  };

  const rejectSpecialRequest = async (requestId) => {
    await rejectSpecialItemRequest(requestId, "Rejected by admin");
    fetchSpecialItemRequests();
  };

  const handleSelectLine = (lineId) => {
    setSelectedLineIds(prev =>
      prev.includes(lineId) ? prev.filter(id => id !== lineId) : [...prev, lineId]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLineIds(lines.map(l => l.line_id));
    } else {
      setSelectedLineIds([]);
    }
  };

  const clearSelection = () => setSelectedLineIds([]);

  const openLineDetail = () => {
    if (selectedLineIds.length !== 1) return;
    const lineToView = lines.find(l => l.line_id === selectedLineIds[0]);
    if (lineToView) {
      setLineDetail(lineToView);
      setIsLineDetailOpen(true);
    }
  };

  // Keyboard: Line Detail ESC closes
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isLineDetailOpen && e.key === 'Escape') {
        e.preventDefault();
        setIsLineDetailOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLineDetailOpen]);

  const handleDeleteSelected = async () => {
    try {
      const requestIds = [];
      const lineIds = [];
      
      selectedLineIds.forEach(id => {
         if (String(id).startsWith('req-')) {
             requestIds.push(parseInt(id.replace('req-', '')));
         } else {
             lineIds.push(id);
         }
      });
      
      if (lineIds.length > 0) {
        await deleteEstimationLines(lineIds);
        fetchLines();
      }
      
      if (requestIds.length > 0) {
        await Promise.all(requestIds.map(id => deleteSpecialItemRequest(id)));
        fetchSpecialItemRequests();
      }

      setSelectedLineIds([]);
      setIsDeleteLinesModalOpen(false);
    } catch (error) {
      console.error("Failed to delete lines", error);
      alert("Failed to delete lines.");
    }
  };

  const handleDuplicateSelected = async () => {
    if (selectedLineIds.length === 0) return;
    try {
      const linesToDuplicate = lines.filter(l => selectedLineIds.includes(l.line_id));
      for (const line of linesToDuplicate) {
        const payload = {
          item_id: line.item_id,
          sub_description: line.sub_description,
          no_of_units: line.no_of_units,
          no_of_units_expr: line.no_of_units_expr,
          length: line.length,
          width: line.width,
          thickness: line.thickness,
          length_expr: line.length_expr,
          width_expr: line.width_expr,
          thickness_expr: line.thickness_expr,
          quantity: line.quantity,
          attachment_name: line.attachment_name,
          attachment_base64: line.attachment_base64,
        };
        await createEstimationLine(estimationId, payload);
      }
      fetchLines();
      setSelectedLineIds([]);
    } catch (error) {
      console.error("Failed to duplicate lines", error);
      alert("Failed to duplicate lines.");
    }
  };

  const openDeleteLinesModal = () => {
    if (selectedLineIds.length === 0) return;
    setIsDeleteLinesModalOpen(true);
  };

  const openEditModal = () => {
    if (selectedLineIds.length !== 1) return;
    const lineToEdit = lines.find(l => l.line_id === selectedLineIds[0]);
    if (lineToEdit) {
      setEditingLine(lineToEdit);
      setIsEditModalOpen(true);
    }
  };

  const handleUpdateLine = async (updatedLineData) => {
    try {
      if (editingLine.is_request) {
        const { item_id, ...cleanUpdatedData } = updatedLineData;
        const payload = {
            division_id: editingLine.item.division_id,
            item_description: editingLine.item.item_description,
            unit: editingLine.item.unit,
            rate: editingLine.rate,
            region: editingLine.item.region || "Default",
            organization: editingLine.item.organization || "RHD",
            attachment_name: editingLine.attachment_name,
            attachment_base64: editingLine.attachment_base64,
            ...cleanUpdatedData
        };
        await updateSpecialItemRequest(editingLine.request_id, payload);
        fetchSpecialItemRequests();
      } else {
        await updateEstimationLine(editingLine.line_id, updatedLineData);
        fetchLines();
      }
      setIsEditModalOpen(false);
      setEditingLine(null);
      setSelectedLineIds([]);
    } catch (error) {
      console.error("Failed to update line", error);
      alert("Failed to update line.");
    }
  };

  const downloadXlsx = () => {
    const wb = XLSX.utils.book_new();
    // Calculate total including pending special items
    const pendingSpecialAmount = specialRequests.filter(r => r.status !== 'approved').reduce((sum, r) => sum + ((r.quantity||0)*(r.rate||0)), 0);
    const grandTotal = lines.reduce((sum, line) => sum + (line.amount || 0), 0) + pendingSpecialAmount;

    let aoa = [
      ["Item Code", "Description", "Sub Desc", "No.", "Length", "Width", "Thickness", "Quantity", "Rate", "Unit", "Amount"]
    ];
    const merges = [];
    let currentRow = 0;
    const boldStyle = { font: { bold: true } };
    currentRow++; // For header row

    const groupLines = (list) => {
      return list.reduce((acc, line) => {
        const divisionName = line.item?.division?.name || 'Uncategorized';
        const orgName = (line.item?.organization || 'RHD');
        const label = orgName && orgName !== 'RHD' ? `${divisionName} (${orgName})` : divisionName;
        if (!acc[label]) acc[label] = [];
        acc[label].push(line);
        return acc;
      }, {});
    };

    const standardLines = lines.filter(l => !l.item?.special_item);
    
    // Combine approved special lines with pending/rejected requests
    const approvedSpecialLines = lines.filter(l => l.item?.special_item);
    const pendingSpecialLines = specialRequests.filter(req => req.status !== 'approved').map(req => ({
        line_id: `req-${req.request_id}`,
        item: {
            item_code: req.item_code || `SP-${String(req.division_id).padStart(2, '0')}/01/${String(req.request_id).padStart(3, '0')}`,
            item_description: req.item_description,
            division: req.division,
            division_id: req.division_id,
            organization: req.organization,
            unit: req.unit,
            special_item: true
        },
        sub_description: req.sub_description,
        no_of_units: req.no_of_units,
        length: req.length,
        width: req.width,
        thickness: req.thickness,
        quantity: req.quantity,
        calculated_qty: req.quantity,
        rate: req.rate,
        amount: (req.quantity || 0) * (req.rate || 0),
        status: req.status
    }));
    
    const specialLines = [...approvedSpecialLines, ...pendingSpecialLines];
    
    const standardGroups = groupLines(standardLines);
    const specialGroups = groupLines(specialLines);

    const addGroupsToAoa = (groups, sectionTitle) => {
      if (Object.keys(groups).length === 0) return;
      
      // Section Header
      if (sectionTitle) {
        aoa.push([sectionTitle.toUpperCase()]);
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 10 } });
        currentRow++;
      }

      Object.entries(groups).forEach(([divisionName, divisionLines]) => {
        // Division name row
        aoa.push([divisionName]);
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 10 } });
        currentRow++;

        // Add line items
        divisionLines.forEach(l => {
          aoa.push([
            l.item?.item_code, l.item?.item_description, l.sub_description,
            l.no_of_units, l.length, l.width, l.thickness, (l.calculated_qty ?? l.quantity),
            l.rate, l.item?.unit, l.amount
          ]);
          currentRow++;
        });

        // Add subtotal row
        const divisionSubtotal = divisionLines.reduce((sum, line) => sum + (line.amount || 0), 0);
        aoa.push(["", "", "", "", "", "", "", "", "", "Subtotal", divisionSubtotal]);
        currentRow++;

        // Add blank row
        aoa.push([]);
        currentRow++;
      });
    };

    addGroupsToAoa(standardGroups, "Item Master");
    addGroupsToAoa(specialGroups, "Special Item Requests");

    // Add grand total row
    aoa.push(["", "", "", "", "", "", "", "", "", "Grand Total", grandTotal]);
    
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;

    // Apply styles by iterating through the worksheet
    // Bold main headers
    for (let C = 0; C <= 10; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (ws[cellAddress]) ws[cellAddress].s = boldStyle;
    }

    // Apply styles to section headers, division headers, and subtotals
    aoa.forEach((row, r) => {
        if (!row || r === 0) return;
        // Section or Division header (merged row with single string)
        if (row.length === 1 && typeof row[0] === 'string') {
             const addr = XLSX.utils.encode_cell({ r, c: 0 });
             if (ws[addr]) ws[addr].s = { ...boldStyle, alignment: { horizontal: "center" } };
        }
        // Subtotal or Grand Total
        if (row[9] === 'Subtotal' || row[9] === 'Grand Total') {
             const addr = XLSX.utils.encode_cell({ r, c: 10 });
             if (ws[addr]) ws[addr].s = boldStyle;
        }
    });

    XLSX.utils.book_append_sheet(wb, ws, "Estimation");
    XLSX.writeFile(wb, `estimation_${estimationId}.xlsx`);
  };

  const downloadCsv = () => {
    // Calculate total including pending special items
    const pendingSpecialAmount = specialRequests.filter(r => r.status !== 'approved').reduce((sum, r) => sum + ((r.quantity||0)*(r.rate||0)), 0);
    const grandTotal = lines.reduce((sum, line) => sum + (line.amount || 0), 0) + pendingSpecialAmount;

    let aoa = [
      ["Item Code", "Description", "Sub Desc", "No.", "Length", "Width", "Thickness", "Quantity", "Rate", "Unit", "Amount"]
    ];

    const groupLines = (list) => {
      return list.reduce((acc, line) => {
        const divisionName = line.item?.division?.name || 'Uncategorized';
        const orgName = (line.item?.organization || 'RHD');
        const label = orgName && orgName !== 'RHD' ? `${divisionName} (${orgName})` : divisionName;
        if (!acc[label]) acc[label] = [];
        acc[label].push(line);
        return acc;
      }, {});
    };

    const standardLines = lines.filter(l => !l.item?.special_item);
    
    // Combine approved special lines with pending/rejected requests
    const approvedSpecialLines = lines.filter(l => l.item?.special_item);
    const pendingSpecialLines = specialRequests.filter(req => req.status !== 'approved').map(req => ({
        line_id: `req-${req.request_id}`,
        item: {
            item_code: req.item_code || `SP-${String(req.division_id).padStart(2, '0')}/01/${String(req.request_id).padStart(3, '0')}`,
            item_description: req.item_description,
            division: req.division,
            division_id: req.division_id,
            organization: req.organization,
            unit: req.unit,
            special_item: true
        },
        sub_description: req.sub_description,
        no_of_units: req.no_of_units,
        length: req.length,
        width: req.width,
        thickness: req.thickness,
        quantity: req.quantity,
        calculated_qty: req.quantity,
        rate: req.rate,
        amount: (req.quantity || 0) * (req.rate || 0),
        status: req.status
    }));
    
    const specialLines = [...approvedSpecialLines, ...pendingSpecialLines];
    
    const standardGroups = groupLines(standardLines);
    const specialGroups = groupLines(specialLines);

    const addGroupsToAoa = (groups, sectionTitle) => {
      if (Object.keys(groups).length === 0) return;
      if (sectionTitle) aoa.push([sectionTitle.toUpperCase()]);

      Object.entries(groups).forEach(([divisionName, divisionLines]) => {
        // Division heading
        aoa.push([divisionName]);

        // Line items
        divisionLines.forEach(l => {
          aoa.push([
            l.item?.item_code, l.item?.item_description, l.sub_description,
            l.no_of_units, l.length, l.width, l.thickness, (l.calculated_qty ?? l.quantity),
            l.rate, l.item?.unit, l.amount
          ]);
        });

        // Subtotal row
        const divisionSubtotal = divisionLines.reduce((sum, line) => sum + (line.amount || 0), 0);
        aoa.push(["", "", "", "", "", "", "", "", "", "Subtotal", divisionSubtotal]);

        // Blank spacer
        aoa.push([]);
      });
    };

    addGroupsToAoa(standardGroups, "Item Master");
    addGroupsToAoa(specialGroups, "Special Item");

    // Grand total
    aoa.push(["", "", "", "", "", "", "", "", "", "Grand Total", grandTotal]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const csv = XLSX.utils.sheet_to_csv(ws);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estimation_${estimationId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    const title = localStorage.getItem(`estimationName:${estimationId}`) || `Estimation #${estimationId}`;
    const doc = new jsPDF('landscape', 'pt', 'a4');
    
    // Calculate total including pending special items
    const pendingSpecialAmount = specialRequests.filter(r => r.status !== 'approved').reduce((sum, r) => sum + ((r.quantity||0)*(r.rate||0)), 0);
    const grandTotal = lines.reduce((sum, line) => sum + (line.amount || 0), 0) + pendingSpecialAmount;
    
    const pageMargin = { top: 80, right: 20, bottom: 40, left: 20 };

    const drawHeaderFooter = () => {
      // Header
      doc.setFillColor(31, 41, 55); // Dark gray bg
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 60, 'F');
      
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.text(title, pageMargin.left, 35);
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Region: ${region || 'No Region'}`, pageMargin.left, 50);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, doc.internal.pageSize.getWidth() - pageMargin.right - 100, 35);

      // Footer with page numbers
      doc.setTextColor(100, 100, 100);
      const str = `Page ${doc.getNumberOfPages()}`;
      doc.setFontSize(9);
      doc.text(str, doc.internal.pageSize.getWidth() - pageMargin.right - doc.getTextWidth(str), doc.internal.pageSize.getHeight() - 20);
    };

    // Draw header on the first page immediately
    drawHeaderFooter();

    const pageHeight = doc.internal.pageSize.getHeight();
    const usableBottom = pageHeight - pageMargin.bottom;

    const groupLines = (list) => {
      return list.reduce((acc, line) => {
        const divisionName = line.item?.division?.name || 'Uncategorized';
        const orgName = (line.item?.organization || 'RHD');
        const label = orgName && orgName !== 'RHD' ? `${divisionName} (${orgName})` : divisionName;
        if (!acc[label]) acc[label] = [];
        acc[label].push(line);
        return acc;
      }, {});
    };

    const standardLines = lines.filter(l => !l.item?.special_item);
    
    // Combine approved special lines with pending/rejected requests
    const approvedSpecialLines = lines.filter(l => l.item?.special_item);
    const pendingSpecialLines = specialRequests.filter(req => req.status !== 'approved').map(req => ({
        line_id: `req-${req.request_id}`,
        item: {
            item_code: req.item_code || `SP-${String(req.division_id).padStart(2, '0')}/01/${String(req.request_id).padStart(3, '0')}`,
            item_description: req.item_description,
            division: req.division,
            division_id: req.division_id,
            organization: req.organization,
            unit: req.unit,
            special_item: true
        },
        sub_description: req.sub_description,
        no_of_units: req.no_of_units,
        length: req.length,
        width: req.width,
        thickness: req.thickness,
        quantity: req.quantity,
        calculated_qty: req.quantity,
        rate: req.rate,
        amount: (req.quantity || 0) * (req.rate || 0),
        status: req.status
    }));
    
    const specialLines = [...approvedSpecialLines, ...pendingSpecialLines];
    
    const standardGroups = groupLines(standardLines);
    const specialGroups = groupLines(specialLines);

    // Calculate totals for sections
    const standardTotal = standardLines.reduce((sum, line) => sum + (line.amount || 0), 0);
    const specialTotal = specialLines.reduce((sum, line) => sum + (line.amount || 0), 0);

    // Flow divisions one after another; add a page only if needed
    let currentY = pageMargin.top + 20;

    const addGroupsToPdf = (groups, sectionTitle, sectionTotal) => {
      if (Object.keys(groups).length === 0) return;

      // Section Title
      if (sectionTitle) {
        if (currentY > usableBottom - 50) {
          doc.addPage();
          drawHeaderFooter();
          currentY = pageMargin.top + 20;
        }
        doc.setFillColor(240, 240, 240);
        doc.rect(pageMargin.left, currentY - 15, doc.internal.pageSize.getWidth() - pageMargin.left - pageMargin.right, 25, 'F');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'bold');
        doc.text(sectionTitle.toUpperCase(), pageMargin.left + 5, currentY);
        doc.setFont(undefined, 'normal');
        currentY += 30;
      }

      Object.entries(groups).forEach(([divisionName, divisionLines], idx) => {
        // If not enough space for a heading and at least one row, add a page
        if (currentY > usableBottom - 50) {
          doc.addPage();
          drawHeaderFooter();
          currentY = pageMargin.top + 20;
        }

        // Division heading
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        doc.setFont(undefined, 'bold');
        doc.text(`Division: ${divisionName}`, pageMargin.left, currentY);
        doc.setFont(undefined, 'normal');
        currentY += 15;

        const body = divisionLines.map(l => [
          l.item?.item_code || '',
          l.item?.item_description || '',
          l.sub_description || '',
          l.no_of_units ?? '',
          l.length ?? '',
          l.width ?? '',
          l.thickness ?? '',
          (l.calculated_qty ?? l.quantity) ?? '',
          l.rate ?? '',
          l.item?.unit || '',
          l.amount ? l.amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '',
        ]);
        const divisionSubtotal = divisionLines.reduce((sum, line) => sum + (line.amount || 0), 0);

        autoTable(doc, {
          startY: currentY,
          margin: pageMargin,
          head: [[
            'Item Code','Description','Sub Desc','No.','Length','Width','Thickness','Qty','Rate','Unit','Amount'
          ]],
          body,
          foot: [['Subtotal','','','','','','','','','', divisionSubtotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})]],
          styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', lineColor: [220, 220, 220], lineWidth: 0.1 },
          headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold' },
          footStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: 'bold', halign: 'right' },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 140 },
            2: { cellWidth: 100 },
            3: { cellWidth: 30, halign: 'right' },
            4: { cellWidth: 40, halign: 'right' },
            5: { cellWidth: 40, halign: 'right' },
            6: { cellWidth: 40, halign: 'right' },
            7: { cellWidth: 40, halign: 'right' },
            8: { cellWidth: 40, halign: 'right' },
            9: { cellWidth: 30, halign: 'center' },
            10: { cellWidth: 60, halign: 'right' },
          },
          didDrawPage: (data) => {
              // Header is drawn initially and on manual page breaks.
              // autoTable also triggers this. We can ensure we don't overdraw or just let it be.
              // To be safe against missing headers on auto-generated page breaks:
              if (data.pageNumber > 1 && data.pageCount === 1) {
                 drawHeaderFooter();
              }
          },
        });

        // Update currentY to position next table below the finished one
        currentY = (doc.lastAutoTable?.finalY || pageMargin.top) + 25;
      });

      // Section Total
      if (currentY > usableBottom - 30) {
        doc.addPage();
        drawHeaderFooter();
        currentY = pageMargin.top + 30;
      }
      doc.setFillColor(229, 231, 235); // Gray-200
      doc.rect(doc.internal.pageSize.getWidth() - pageMargin.right - 250, currentY - 10, 250, 25, 'F');
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`Grand Total (${sectionTitle}): ${sectionTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, doc.internal.pageSize.getWidth() - pageMargin.right - 10, currentY + 7, { align: 'right' });
      currentY += 40;
    };

    addGroupsToPdf(standardGroups, "Item Master", standardTotal);
    addGroupsToPdf(specialGroups, "Special Item", specialTotal);

    // Grand Total All Items
    if (currentY > usableBottom - 50) {
        doc.addPage();
        drawHeaderFooter();
        currentY = pageMargin.top + 50;
    }
    
    // Big Grand Total Box
    currentY += 20;
    doc.setDrawColor(16, 185, 129); // Emerald-500
    doc.setLineWidth(2);
    doc.rect(pageMargin.left, currentY, doc.internal.pageSize.getWidth() - pageMargin.left - pageMargin.right, 50);
    
    doc.setFontSize(18);
    doc.setTextColor(16, 185, 129); // Emerald-500
    doc.setFont(undefined, 'bold');
    doc.text("GRAND TOTAL (ALL ITEMS)", pageMargin.left + 20, currentY + 32);
    
    doc.setTextColor(0, 0, 0);
    doc.text(grandTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}), doc.internal.pageSize.getWidth() - pageMargin.right - 20, currentY + 32, { align: 'right' });

    doc.save(`estimation_${estimationId}.pdf`);
  };

  // Download a single line's attachment (base64 stored on the line)
  const downloadAttachment = (line) => {
    const b64 = line?.attachment_base64;
    const name = line?.attachment_name || `attachment_${line?.line_id || ''}`;
    if (!b64) return;
    try {
      // Create a data URL and trigger download. Use generic binary mime.
      const a = document.createElement('a');
      a.href = `data:application/octet-stream;base64,${b64}`;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Failed to download attachment', e);
      alert('Failed to download attachment.');
    }
  };

  const [activeTab, setActiveTab] = useState("standard"); // 'standard' | 'special' | 'summary'

  const groupedLines = React.useMemo(() => {
    // Filter lines based on active tab
    const filteredLines = lines.filter(l => {
      if (activeTab === 'summary') return true;
      if (activeTab === 'standard') {
        return !l.item?.special_item;
      } else {
        return !!l.item?.special_item;
      }
    });

    const groups = filteredLines.reduce((acc, line) => {
      const divisionName = line.item?.division?.name || 'Uncategorized';
      const orgName = (line.item?.organization || 'RHD');
      const label = orgName && orgName !== 'RHD' ? `${divisionName} (${orgName})` : divisionName;
      if (!acc[label]) {
        acc[label] = [];
      }
      acc[label].push(line);
      return acc;
    }, {});

    // For Special Item tab and Summary tab, also append pending/rejected requests
    if (activeTab === 'special' || activeTab === 'summary') {
        // First, iterate over existing lines that are special items (Approved ones) and ensure they have 'approved' status
        Object.values(groups).forEach(groupLines => {
            groupLines.forEach(l => {
                if (l.item?.special_item && !l.status) {
                    l.status = 'approved';
                }
            });
        });

        // Group requests by division
        specialRequests.forEach(req => {
            // We only show pending/rejected here. Approved ones become lines.
            if (req.status === 'approved') return;
            
            const divisionName = req.division?.name || 'Uncategorized';
            const orgName = (req.organization || 'RHD');
            const label = orgName && orgName !== 'RHD' ? `${divisionName} (${orgName})` : divisionName;
            
            if (!groups[label]) {
                groups[label] = [];
            }

            // Calculate quantity if missing
            const length = parseFloat(req.length) || 1;
            const width = parseFloat(req.width) || 1;
            const thickness = parseFloat(req.thickness) || 1;
            const no_of_units = parseFloat(req.no_of_units) || 1;
            
            // If any dimension is present, we use the formula. If all are missing (only no_of_units), it's just no_of_units.
            // But simplified: if value is 0 or null, treat as 1 for multiplication, UNLESS it's explicitly 0? 
            // Usually dimensions are non-zero.
            // Let's use the logic: Qty = No * L * W * T. 
            // We need to check which fields are "active". 
            // For now, simple multiplication of non-zero values is likely what's expected.
            // However, to be precise: if a field is NULL/Empty, treat as 1.
            
            const calcQty = (req.quantity) ? parseFloat(req.quantity) : (no_of_units * length * width * thickness);
            
            // Map request to line-like structure
            groups[label].push({
                line_id: `req-${req.request_id}`,
                is_request: true,
                request_id: req.request_id,
                status: req.status,
                reason: req.reason,
                item: {
                    item_code: req.item_code || `SP-${String(req.division_id).padStart(2, '0')}/01/${String(req.request_id).padStart(3, '0')}`,
                    item_description: req.item_description,
                    division_id: req.division_id,
                    division: req.division,
                    unit: req.unit,
                    special_item: true // treated as special
                },
                sub_description: req.sub_description,
                no_of_units: req.no_of_units,
                length: req.length,
                width: req.width,
                thickness: req.thickness,
                length_expr: req.length_expr,
                width_expr: req.width_expr,
                thickness_expr: req.thickness_expr,
                quantity: calcQty,
                calculated_qty: calcQty, 
                rate: req.rate,
                amount: calcQty * (req.rate || 0),
                attachment_name: req.attachment_name,
                attachment_base64: req.attachment_base64,
                requested_by: req.requested_by
            });
        });
    }
    
    return groups;
  }, [lines, specialRequests, activeTab]);

  // Calculate total based on current view
  const currentViewTotal = React.useMemo(() => {
    let sum = 0;
    Object.values(groupedLines).forEach(group => {
        group.forEach(line => {
            sum += (line.amount || 0);
        });
    });
    return sum;
  }, [groupedLines]);

  // Refetch items when region changes and persist selection
  useEffect(() => {
    if (region) {
      fetchItems(region);
      try { localStorage.setItem(`estimationRegion:${estimationId}`, region); } catch {}
    }
  }, [region]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isDownloadMenuOpen && downloadMenuRef.current && !downloadMenuRef.current.contains(e.target)) {
        setIsDownloadMenuOpen(false);
      }
    };
    const handleKey = (e) => {
      if (!isDownloadMenuOpen) return;
      if (e.key === 'Escape' || e.key === 'Tab') {
        setIsDownloadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isDownloadMenuOpen]);

  return (
    <div className="relative bg-white p-4 sm:p-6 -mx-6 -mb-6 w-[calc(100%+3rem)]">
      {/* Sticky controls header */}
      <div className="sticky top-0 z-30 bg-white mb-4 py-2 border-b border-gray-200">
        <div className="grid grid-cols-2 items-start gap-y-2">
          {/* Left column: title */}
          <div>
            <h2 className="text-xl font-semibold">Estimation : {estimationTitle}</h2>
          </div>
          {/* Right column: controls */}
          <div className="justify-self-end flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-700">Region:</span>
              <span className="text-xs text-gray-900">{region || '—'}</span>
            </div>
            <div className="flex gap-2">
              {canEdit && (
                <>
                  <button onClick={() => setIsImportModalOpen(true)} className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 text-xs font-medium py-1 px-3 rounded inline-flex items-center gap-1">
                    <FaUpload className="w-3 h-3" />
                    <span>Import</span>
                  </button>
                  <button onClick={() => setIsEditingEnabled(!isEditingEnabled)} className={`border text-xs font-medium py-1 px-3 rounded inline-flex items-center gap-1 ${isEditingEnabled ? 'bg-orange-600 border-orange-600 text-white hover:bg-orange-700' : 'bg-white border-orange-600 text-orange-600 hover:bg-orange-50'}`}>
                    {isEditingEnabled ? <FaCheck className="w-3 h-3" /> : <FaEdit className="w-3 h-3" />}
                    <span>{isEditingEnabled ? 'Disable Editing' : 'Enable Editing'}</span>
                  </button>
                  {isEditingEnabled && <span className="text-orange-600 flex items-center" title="Direct Editing Enabled"><FaExclamationTriangle className="w-4 h-4" /></span>}
                  <button onClick={() => setIsAddLineModalOpen(true)} className="bg-teal-700 hover:bg-teal-900 text-white text-xs font-extralight py-1 px-4 rounded inline-flex items-center gap-1">
                    <FaPlus className="w-3 h-3" />
                    <span>Add Line</span>
                  </button>
                </>
              )}
              <div className="relative" ref={downloadMenuRef}>
                <button
                  onClick={() => setIsDownloadMenuOpen((v) => !v)}
                  disabled={!lines.length}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-medium py-1 px-4 rounded inline-flex items-center gap-1 disabled:opacity-60"
                  aria-haspopup="menu"
                  aria-expanded={isDownloadMenuOpen}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setIsDownloadMenuOpen((v) => !v);
                      e.preventDefault();
                    }
                    if (e.key === 'Escape') {
                      setIsDownloadMenuOpen(false);
                    }
                  }}
                >
                  <span>Download</span>
                </button>
                {isDownloadMenuOpen && (
                  <div role="menu" className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded shadow-md z-50">
                    <button
                      role="menuitem"
                      onClick={() => { downloadCsv(); setIsDownloadMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 flex items-center gap-2"
                      tabIndex={0}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') { downloadCsv(); setIsDownloadMenuOpen(false); } }}
                    >
                      <FaFileCsv className="w-3 h-3 text-teal-700" />
                      <span>CSV</span>
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { downloadXlsx(); setIsDownloadMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 flex items-center gap-2"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') { downloadXlsx(); setIsDownloadMenuOpen(false); } }}
                    >
                      <FaFileExcel className="w-3 h-3 text-teal-700" />
                      <span>XLSX</span>
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { downloadPdf(); setIsDownloadMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 flex items-center gap-2"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') { downloadPdf(); setIsDownloadMenuOpen(false); } }}
                    >
                      <FaFilePdf className="w-3 h-3 text-teal-700" />
                      <span>PDF</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Bottom row: selected-line actions aligned under title */}
          {selectedLineIds.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-1">
                <div className="text-xs">{selectedLineIds.length} selected line(s)</div>
                {selectedLineIds.length === 1 ? (
                  <>
                    <button className="bg-gray-200 text-gray-900 text-xs px-3 py-1 rounded" onClick={openLineDetail}>Line Detail</button>
                    {canEdit && (
                      <>
                        <button className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-3 py-1 rounded" onClick={openEditModal}>Edit</button>
                        {activeTab !== 'special' && (
                          <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1 rounded flex items-center gap-1" onClick={handleDuplicateSelected}>
                            <FaCopy className="w-3 h-3" />
                            <span>Duplicate</span>
                          </button>
                        )}
                        <button className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded" onClick={openDeleteLinesModal}>Delete</button>
                      </>
                    )}
                    <button className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-3 py-1 rounded" onClick={clearSelection}>Clear selection</button>
                  </>
                ) : (
                  <>
                    {canEdit && (
                      <>
                        {activeTab !== 'special' && (
                          <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1 rounded flex items-center gap-1" onClick={handleDuplicateSelected}>
                            <FaCopy className="w-3 h-3" />
                            <span>Duplicate</span>
                          </button>
                        )}
                        <button className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded" onClick={openDeleteLinesModal}>Delete</button>
                      </>
                    )}
                    <button className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-3 py-1 rounded" onClick={clearSelection}>Clear selection</button>
                  </>
                )}
              </div>
              {/* Empty right cell to keep grid alignment */}
              <div className="justify-self-end" />
            </>
          )}
        </div>
      </div>
      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          className={`px-4 py-2 text-sm font-medium focus:outline-none ${activeTab === 'standard' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('standard')}
        >
          Item Master
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium focus:outline-none ${activeTab === 'special' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('special')}
        >
          Special Item Requests
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium focus:outline-none ${activeTab === 'summary' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
      </div>

      {/* Scrollable table container */}
      <div className="overflow-auto max-h-[75vh] pr-2">
      {activeTab === 'summary' ? (
        <div className="space-y-12">
            {(() => {
                const groupLines = (list) => {
                    return list.reduce((acc, line) => {
                        const divisionName = line.item?.division?.name || 'Uncategorized';
                        const orgName = (line.item?.organization || 'RHD');
                        const label = orgName && orgName !== 'RHD' ? `${divisionName} (${orgName})` : divisionName;
                        if (!acc[label]) acc[label] = [];
                        acc[label].push(line);
                        return acc;
                    }, {});
                };

                const standardLines = lines.filter(l => !l.item?.special_item);
                const approvedSpecialLines = lines.filter(l => l.item?.special_item);
                const pendingSpecialLines = specialRequests.filter(req => req.status !== 'approved').map(req => ({
                    line_id: `req-${req.request_id}`,
                    item: {
                        item_code: req.item_code || `SP-${String(req.division_id).padStart(2, '0')}/01/${String(req.request_id).padStart(3, '0')}`,
                        item_description: req.item_description,
                        division: req.division,
                        division_id: req.division_id,
                        organization: req.organization,
                        unit: req.unit,
                        special_item: true
                    },
                    sub_description: req.sub_description,
                    no_of_units: req.no_of_units,
                    length: req.length,
                    width: req.width,
                    thickness: req.thickness,
                    quantity: req.quantity,
                    calculated_qty: req.quantity,
                    rate: req.rate,
                    amount: (req.quantity || 0) * (req.rate || 0),
                    status: req.status || 'approved'
                }));
                
                const specialLines = [...approvedSpecialLines, ...pendingSpecialLines];
                
                const standardGroups = groupLines(standardLines);
                const specialGroups = groupLines(specialLines);

                const standardTotal = standardLines.reduce((sum, line) => sum + (line.amount || 0), 0);
                const specialTotal = specialLines.reduce((sum, line) => sum + (line.amount || 0), 0);
                const grandTotal = standardTotal + specialTotal;

                const renderSection = (groups, title, sectionTotal) => {
                    if (Object.keys(groups).length === 0) return null;
                    return (
                        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
                                <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wide">{title}</h3>
                            </div>
                            <div className="p-6 space-y-8">
                                {Object.entries(groups).map(([divisionName, divisionLines]) => {
                                    const divisionSubtotal = divisionLines.reduce((sum, line) => sum + (line.amount || 0), 0);
                                    return (
                                        <div key={divisionName} className="space-y-3">
                                            <h4 className="text-md font-semibold text-gray-700 border-l-4 border-teal-500 pl-3">{divisionName}</h4>
                                            <div className="overflow-x-auto rounded-lg border border-gray-100">
                                                <table className="min-w-full text-xs">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Item Code</th>
                                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Description</th>
                                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Sub Desc</th>
                                                            <th className="px-3 py-2 text-right font-semibold text-gray-600">No.</th>
                                                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Dims (L/W/T)</th>
                                                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Qty</th>
                                                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Rate</th>
                                                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {divisionLines.map(l => (
                                                            <tr key={l.line_id} className="hover:bg-gray-50">
                                                                <td className="px-3 py-2 font-medium text-gray-900">{l.item?.item_code}</td>
                                                                <td className="px-3 py-2 text-gray-600">{l.item?.item_description}</td>
                                                                <td className="px-3 py-2 text-gray-500 italic">{l.sub_description}</td>
                                                                <td className="px-3 py-2 text-right text-gray-600">{l.no_of_units}</td>
                                                                <td className="px-3 py-2 text-right text-gray-600">
                                                                    {[l.length, l.width, l.thickness].filter(x=>x!=null && x!=="").join(' / ')}
                                                                </td>
                                                                <td className="px-3 py-2 text-right text-gray-600 font-medium">{(l.calculated_qty ?? l.quantity)} {l.item?.unit}</td>
                                                                <td className="px-3 py-2 text-right text-gray-600">{l.rate}</td>
                                                                <td className="px-3 py-2 text-right text-gray-900">{formatAmount(l.amount)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr className="bg-gray-50 font-semibold">
                                                            <td colSpan={7} className="px-3 py-2 text-right text-gray-700">Subtotal</td>
                                                            <td className="px-3 py-2 text-right text-gray-900">{formatAmount(divisionSubtotal)}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
                                <div className="text-right">
                                    <span className="block text-sm text-gray-500 font-medium">Grand Total ({title})</span>
                                    <span className="block text-xl font-bold text-gray-900">{formatAmount(sectionTotal)}</span>
                                </div>
                            </div>
                        </div>
                    );
                };

                return (
                    <>
                        {renderSection(standardGroups, "Item Master", standardTotal)}
                        {renderSection(specialGroups, "Special Items", specialTotal)}
                        
                        <div className="mt-12 mb-8 bg-emerald-50 border-2 border-emerald-500 rounded-xl p-8 flex flex-col sm:flex-row justify-between items-center shadow-md">
                            <h2 className="text-2xl sm:text-3xl font-bold text-emerald-800 uppercase tracking-tight">Grand Total (All Items)</h2>
                            <div className="text-3xl sm:text-4xl font-extrabold text-emerald-700 mt-4 sm:mt-0">
                                {formatAmount(grandTotal)}
                            </div>
                        </div>
                    </>
                );
            })()}
        </div>
      ) : (
      <>
      {Object.entries(groupedLines).map(([divisionName, divisionLines]) => {
        const divisionSubtotal = divisionLines.reduce((sum, line) => sum + (line.amount || 0), 0);
        
        // Determine visible columns (show all if editing is enabled)
        const hasSubDesc = isEditingEnabled || divisionLines.some(l => l.sub_description && String(l.sub_description).trim());
        const hasLength = isEditingEnabled || divisionLines.some(l => (l.length != null && l.length !== "") || (l.length_expr && String(l.length_expr).trim()));
        const hasWidth = isEditingEnabled || divisionLines.some(l => (l.width != null && l.width !== "") || (l.width_expr && String(l.width_expr).trim()));
        const hasThickness = isEditingEnabled || divisionLines.some(l => (l.thickness != null && l.thickness !== "") || (l.thickness_expr && String(l.thickness_expr).trim()));
        const hasQuantity = isEditingEnabled || divisionLines.some(l => (l.quantity != null && l.quantity !== "") || (l.calculated_qty != null && l.calculated_qty !== 0));
        const hasAttachment = isEditingEnabled || divisionLines.some(l => l.attachment_name && String(l.attachment_name).trim());

        return (
          <div key={divisionName} className="mb-8">
            <h3 className="text-md font-semibold mb-2 bg-gray-200 p-2 rounded">{divisionName}</h3>
            <div className="border rounded-lg flex flex-col border-gray-200">
              <div className="overflow-x-auto w-full">
                <div>
                  <table className="min-w-full border-collapse table-fixed">
                    <thead className="sticky top-0 z-10 bg-gray-100 border-b-2 border-gray-200">
                      <tr>
                        {canEdit && (
                          <th className="p-2 w-4">
                            <input
                              type="checkbox"
                              onChange={(e) => {
                                const allLineIdsInDivision = divisionLines.map(l => l.line_id);
                                if (e.target.checked) {
                                  setSelectedLineIds(prev => [...new Set([...prev, ...allLineIdsInDivision])]);
                                } else {
                                  setSelectedLineIds(prev => prev.filter(id => !allLineIdsInDivision.includes(id)));
                                }
                              }}
                              checked={divisionLines.every(l => selectedLineIds.includes(l.line_id))}
                            />
                          </th>
                        )}
                        <th className="px-2 py-1 text-left text-xs font-bold border-r text-gray-800 border-gray-200 relative group select-none" style={{ width: columnWidths.item_code, minWidth: columnWidths.item_code }}>
                          Item Code
                          <div
                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-teal-400 z-10"
                            onMouseDown={(e) => startResizing(e, 'item_code')}
                          />
                        </th>
                        <th className="px-2 py-1 text-left text-xs font-bold border-r text-gray-800 border-gray-200 relative group select-none" style={{ width: columnWidths.description, minWidth: columnWidths.description }}>
                          Description
                          <div
                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-teal-400 z-10"
                            onMouseDown={(e) => startResizing(e, 'description')}
                          />
                        </th>
                        {hasSubDesc && (
                          <th className="px-2 py-1 text-left text-xs font-bold border-r text-gray-800 border-gray-200 relative group select-none" style={{ width: columnWidths.sub_description, minWidth: columnWidths.sub_description }}>
                            Sub Desc
                            <div
                              className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-teal-400 z-10"
                              onMouseDown={(e) => startResizing(e, 'sub_description')}
                            />
                          </th>
                        )}
                        <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">No.</th>
                        {hasLength && <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Length</th>}
                        {hasWidth && <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Width</th>}
                        {hasThickness && <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Thickness</th>}
                        {hasQuantity && <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Quantity</th>}
                        <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Rate</th>
                        <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Unit</th>
                        {hasAttachment && <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Attachment</th>}
                        {activeTab === 'special' && <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[100px] text-gray-800 border-gray-200">Status</th>}
                        <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {divisionLines.map((l, i) => (
                        <tr key={l.line_id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-teal-50 transition-colors ${selectedLineIds.includes(l.line_id) ? 'bg-teal-100' : ''}`}>
                          {canEdit && (
                            <td className="p-2">
                              {!l.is_request && (
                                <input
                                  type="checkbox"
                                  checked={selectedLineIds.includes(l.line_id)}
                                  onChange={() => handleSelectLine(l.line_id)}
                                />
                              )}
                            </td>
                          )}
                          {/* Item Code */}
                          <td className="px-2 py-1 whitespace-normal break-words text-xs border-r text-gray-800 border-gray-200" onDoubleClick={() => !l.is_request && handleCellDoubleClick(l, 'item_code')}>
                             {inlineEditingCell?.lineId === l.line_id && inlineEditingCell?.field === 'item_code' ? (
                                <select
                                    autoFocus
                                    value={inlineValue}
                                    onChange={(e) => setInlineValue(e.target.value)}
                                    onBlur={() => setInlineEditingCell(null)}
                                    onKeyDown={handleInlineKeyDown}
                                    className="w-full text-xs border border-teal-500 rounded px-1 py-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {(uniqueItemsByDivision[l.item?.division_id]?.byCode || []).map(it => <option key={it.item_id} value={it.item_id}>{it.item_code}</option>)}
                                </select>
                             ) : l.item?.item_code}
                          </td>
                          {/* Description */}
                          <td className="px-2 py-1 whitespace-normal break-words text-xs border-r text-gray-800 border-gray-200" onDoubleClick={() => !l.is_request && handleCellDoubleClick(l, 'description')}>
                             {inlineEditingCell?.lineId === l.line_id && inlineEditingCell?.field === 'description' ? (
                                <select
                                    autoFocus
                                    value={inlineValue}
                                    onChange={(e) => setInlineValue(e.target.value)}
                                    onBlur={() => setInlineEditingCell(null)}
                                    onKeyDown={handleInlineKeyDown}
                                    className="w-full text-xs border border-teal-500 rounded px-1 py-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {(uniqueItemsByDivision[l.item?.division_id]?.byDesc || []).map(it => <option key={it.item_id} value={it.item_id}>{it.item_description}</option>)}
                                </select>
                             ) : l.item?.item_description}
                          </td>
                          {/* Sub Desc */}
                          {hasSubDesc && (
                            <td className="px-2 py-1 whitespace-normal break-words text-xs border-r text-gray-800 border-gray-200" onDoubleClick={() => !l.is_request && handleCellDoubleClick(l, 'sub_description')}>
                               {inlineEditingCell?.lineId === l.line_id && inlineEditingCell?.field === 'sub_description' ? (
                                  <input autoFocus value={inlineValue} onChange={e=>setInlineValue(e.target.value)} onBlur={() => setInlineEditingCell(null)} onKeyDown={handleInlineKeyDown} className="w-full text-xs border border-teal-500 rounded px-1 py-0.5" />
                               ) : l.sub_description}
                            </td>
                          )}
                          {/* No. */}
                          <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200" onDoubleClick={() => !l.is_request && handleCellDoubleClick(l, 'no_of_units')}>
                             {inlineEditingCell?.lineId === l.line_id && inlineEditingCell?.field === 'no_of_units' ? (
                                <input autoFocus value={inlineValue} onChange={e=>setInlineValue(e.target.value)} onBlur={() => setInlineEditingCell(null)} onKeyDown={handleInlineKeyDown} className="w-full text-xs border border-teal-500 rounded px-1 py-0.5" />
                             ) : renderDimensionCell(l, "no_of_units")}
                          </td>
                          {/* Length */}
                          {hasLength && (
                            <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200" onDoubleClick={() => !l.is_request && handleCellDoubleClick(l, 'length')}>
                               {inlineEditingCell?.lineId === l.line_id && inlineEditingCell?.field === 'length' ? (
                                  <input autoFocus value={inlineValue} onChange={e=>setInlineValue(e.target.value)} onBlur={() => setInlineEditingCell(null)} onKeyDown={handleInlineKeyDown} className="w-full text-xs border border-teal-500 rounded px-1 py-0.5" />
                               ) : renderDimensionCell(l, "length")}
                            </td>
                          )}
                          {/* Width */}
                          {hasWidth && (
                            <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200" onDoubleClick={() => !l.is_request && handleCellDoubleClick(l, 'width')}>
                               {inlineEditingCell?.lineId === l.line_id && inlineEditingCell?.field === 'width' ? (
                                  <input autoFocus value={inlineValue} onChange={e=>setInlineValue(e.target.value)} onBlur={() => setInlineEditingCell(null)} onKeyDown={handleInlineKeyDown} className="w-full text-xs border border-teal-500 rounded px-1 py-0.5" />
                               ) : renderDimensionCell(l, "width")}
                            </td>
                          )}
                          {/* Thickness */}
                          {hasThickness && (
                            <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200" onDoubleClick={() => !l.is_request && handleCellDoubleClick(l, 'thickness')}>
                               {inlineEditingCell?.lineId === l.line_id && inlineEditingCell?.field === 'thickness' ? (
                                  <input autoFocus value={inlineValue} onChange={e=>setInlineValue(e.target.value)} onBlur={() => setInlineEditingCell(null)} onKeyDown={handleInlineKeyDown} className="w-full text-xs border border-teal-500 rounded px-1 py-0.5" />
                               ) : renderDimensionCell(l, "thickness")}
                            </td>
                          )}
                          {/* Quantity (Merged) */}
                          {hasQuantity && (
                            <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200"
                                onDoubleClick={() => !l.is_request && !hasDimensions(l) && handleCellDoubleClick(l, 'quantity')}
                                style={{ cursor: !l.is_request && !hasDimensions(l) ? 'pointer' : 'default', backgroundColor: !l.is_request && !hasDimensions(l) ? 'transparent' : '#f9fafb' }}
                            >
                               {inlineEditingCell?.lineId === l.line_id && inlineEditingCell?.field === 'quantity' ? (
                                  <input autoFocus type="number" value={inlineValue} onChange={e=>setInlineValue(e.target.value)} onBlur={() => setInlineEditingCell(null)} onKeyDown={handleInlineKeyDown} className="w-full text-xs border border-teal-500 rounded px-1 py-0.5" />
                               ) : (l.calculated_qty ?? l.quantity)}
                            </td>
                          )}
                          <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{l.rate}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{l.item?.unit}</td>
                          {hasAttachment && (
                            <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">
                                {l.attachment_name ? (
                                <span className="inline-flex items-center gap-2">
                                    <span className="font-medium">{l.attachment_name}</span>
                                    <button
                                    type="button"
                                    onClick={() => downloadAttachment(l)}
                                    className="px-2 py-1 rounded text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700"
                                    >
                                    Download
                                    </button>
                                </span>
                                ) : '—'}
                            </td>
                          )}
                          {activeTab === 'special' && (
                            <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">
                               <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${l.status==='rejected'?'bg-red-100 text-red-700': l.status==='approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                 {l.status ? l.status.toUpperCase() : 'PENDING'}
                               </span>
                            </td>
                          )}
                          <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">
                            {formatAmount(l.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-2">
              <div className="inline-flex items-center gap-2 bg-teal-50 text-teal-900 border border-teal-200 rounded-full px-3 py-1 shadow-sm">
                <span className="text-xs font-medium">Subtotal · {divisionName}</span>
                <span className="text-xs font-semibold">{formatAmount(divisionSubtotal)}</span>
              </div>
            </div>
          </div>
        );
      })}
      
      <div className="flex justify-end mt-4 pb-4">
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-teal-50 to-emerald-50 text-teal-900 border border-teal-200 rounded-lg px-4 py-2 shadow-sm">
          <span className="text-sm font-semibold">Grand Total {activeTab === 'special' ? '(Special Items)' : '(Standard Items)'}</span>
          <span className="text-xl font-bold">{formatAmount(currentViewTotal)}</span>
        </div>
      </div>
      </>
      )}
      </div>

      {isAddLineModalOpen && (
        <AddLineModal
          items={items}
          lines={lines}
          onClose={() => setIsAddLineModalOpen(false)}
          onSave={fetchLines}
          onRequestSubmitted={fetchSpecialItemRequests}
          estimationId={estimationId}
          region={region}
        />
      )}

      {isDeleteLinesModalOpen && (
        <ConfirmDeleteLinesModal
          selectedIds={selectedLineIds}
          lines={lines}
          onClose={() => setIsDeleteLinesModalOpen(false)}
          onConfirm={handleDeleteSelected}
        />
      )}

      {isEditModalOpen && (
        <EditLineModal
          line={editingLine}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleUpdateLine}
        />
      )}

      {isLineDetailOpen && lineDetail && (
        <LineDetailModal
          line={lineDetail}
          onClose={() => setIsLineDetailOpen(false)}
        />
      )}

      {importBanner && (
        <div className={`mt-3 p-3 rounded-md border text-sm ${importBanner.type === 'error' ? 'bg-red-50 text-red-700 border-red-300' : importBanner.type === 'warning' ? 'bg-orange-50 text-orange-700 border-orange-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300'}`}>
          <div className="flex justify-between items-start">
            <span>{importBanner.message}</span>
            <button className="text-xs opacity-70 hover:opacity-100" onClick={() => setImportBanner(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50" role="dialog" aria-modal="true">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto z-50 relative border border-gray-200">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              disabled={isImporting}
              className={`absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full ${isImporting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'} transition`}
              aria-label="Close import modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Import Estimation Lines</h3>
            <p className="text-xs text-gray-600 mb-4">Upload a CSV or XLSX containing estimation lines. Choose whether to replace existing lines or add on top.</p>
            <div className="space-y-4">
              <div className="space-y-3">
                <input
                  type="file"
                  accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={(e) => { setImportFile(e.target.files[0] || null); setImportError(""); setIsImportDragging(false); }}
                  ref={fileInputRef}
                  id="importLinesFileInput"
                  className="hidden"
                />
                <div
                  onClick={() => !isImporting && fileInputRef.current && fileInputRef.current.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsImportDragging(true); }}
                  onDragLeave={() => setIsImportDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files && e.dataTransfer.files[0];
                    if (f) { setImportFile(f); setImportError(""); }
                    setIsImportDragging(false);
                  }}
                  className={`border-2 rounded-lg p-5 text-center cursor-pointer transition shadow-sm ${isImportDragging ? 'border-indigo-400 bg-indigo-50' : 'border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100'} ${importError ? 'border-red-400 bg-red-50' : ''}`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <FaUpload className="w-6 h-6 text-gray-600" />
                    {!importFile ? (
                      <>
                        <div className="text-sm text-gray-800">Click to choose a file or drag & drop</div>
                        <div className="text-xs text-gray-500">Accepted: .csv, .xlsx</div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-800">Selected: <span className="font-medium">{importFile.name}</span></div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    disabled={isImporting}
                    className={`${isImporting ? 'opacity-70 cursor-not-allowed' : ''} inline-flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-md text-xs hover:bg-gray-900`}
                  >
                    <FaUpload className="w-3 h-3" />
                    <span>Browse files</span>
                  </button>
                  {importFile && (
                    <button
                      type="button"
                      onClick={() => { setImportFile(null); setImportError(""); }}
                      disabled={isImporting}
                      className={`${isImporting ? 'opacity-70 cursor-not-allowed' : ''} text-xs text-gray-700 hover:text-gray-900 underline`}
                    >
                      Remove selection
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input type="radio" name="importModeLines" value="append" checked={importMode === 'append'} onChange={(e) => setImportMode(e.target.value)} />
                  <span>Add on top (append)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="importModeLines" value="replace" checked={importMode === 'replace'} onChange={(e) => setImportMode(e.target.value)} />
                  <span>Replace existing lines</span>
                </label>
              </div>
              <div className="flex items-center justify-between">
                {importError && (
                  <div className="text-sm text-red-600">{importError}</div>
                )}
                {!importFile && !importError && (
                  <div className="text-xs text-gray-500">Select a file to import</div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  disabled={isImporting}
                  className={`${isImporting ? 'opacity-70 cursor-not-allowed' : ''} bg-white border border-indigo-600 text-indigo-700 hover:bg-indigo-50 font-semibold text-sm py-1 px-4 rounded-md`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportClick}
                  disabled={isImporting}
                  className={`${isImporting ? 'opacity-70 cursor-not-allowed' : ''} bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold text-sm py-1 px-6 rounded-md`}
                >
                  {isImporting ? 'Importing…' : 'Import'}
                </button>
              </div>
              {isImporting && (
                <div className="mt-3">
                  <div className="h-2 bg-gray-200 rounded">
                    <div className="h-2 bg-indigo-600 rounded" style={{ width: `${importProgress || 10}%`, transition: 'width 200ms' }}></div>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-600">Processing rows… {importProgress}%</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// NOTE: Import modal temporarily rendered inline above to bypass a parser error.

function AddLineModal({ items, lines, onClose, onSave, onRequestSubmitted, estimationId, region }) {
  const [activeTab, setActiveTab] = useState("standard"); // 'standard' | 'special'
  const [form, setForm] = useState({ item_id: "", sub_description: "", no_of_units: 1, length: "", width: "", thickness: "", quantity: "" });
  const [keepOpen, setKeepOpen] = useState(true);
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitNotice, setSubmitNotice] = useState("");

  // Organization selection state
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationName, setSelectedOrganizationName] = useState("RHD");
  const normalizeOrg = (s) => (s || 'RHD').trim().toUpperCase();
  // Region selection (locked to passed-in region for RHD, selectable for other orgs)
  const [selectedRegion, setSelectedRegion] = useState(region || "");
  const [orgRegions, setOrgRegions] = useState([]);
  const canonRegion = (s) => {
    const x = String(s || '').toLowerCase();
    // unify common spellings and spacing around punctuation
    let y = x.replace(/\s+/g, ' ').trim();
    y = y.replace(/\s*:\s*/g, ':'); // normalize colon spacing ("Zone-B :" -> "Zone-B:")
    // normalize synonyms
    y = y.replace(/cumilla/g, 'comilla');
    y = y.replace(/chittagong/g, 'chattogram');
    return y;
  };
  useEffect(() => {
    const orgIsRHD = normalizeOrg(selectedOrganizationName) === 'RHD';
    if (orgIsRHD) {
      setSelectedRegion(region || "");
    } else {
      // When org changes away from RHD, default to first region from orgRegions
      if (!selectedRegion || !orgRegions.includes(selectedRegion)) {
        setSelectedRegion(orgRegions[0] || "");
      }
    }
  }, [selectedOrganizationName, region, orgRegions]);
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const res = await listOrganizations();
        setOrganizations(res || []);
        // Default to RHD if available
        const rhd = (res || []).find(o => (o.name || '').toUpperCase() === 'RHD');
        if (rhd) setSelectedOrganizationName(rhd.name);
      } catch (e) {
        console.error('Failed to fetch organizations', e);
      }
    };
    fetchOrgs();
  }, []);

  // Load regions for the selected organization
  useEffect(() => {
    const loadRegions = async () => {
      try {
        const org = (organizations || []).find(o => normalizeOrg(o.name) === normalizeOrg(selectedOrganizationName));
        if (!org) { setOrgRegions([]); return; }
        const regs = await listRegions(org.org_id);
        const names = (regs || []).map(r => r.name).filter(Boolean).sort();
        setOrgRegions(names);
      } catch (e) {
        console.error('Failed to fetch regions for organization', e);
        setOrgRegions([]);
      }
    };
    loadRegions();
  }, [organizations, selectedOrganizationName]);

  // Division-first selection state: fetch all divisions from backend so "Special Item" is visible
  const [divisions, setDivisions] = useState([]);
  useEffect(() => {
    const fetchDivisions = async () => {
      try {
        const res = await listDivisions();
        const list = (res || []).map(d => ({ id: d.division_id ?? d.id, name: d.name }));
        setDivisions(list);
      } catch (e) {
        console.error('Failed to fetch divisions', e);
      }
    };
    fetchDivisions();
  }, []);
  const [selectedDivisionId, setSelectedDivisionId] = useState("");

  // Unit and unit-based input rules
  const [selectedUnit, setSelectedUnit] = useState("");
  const [unitMode, setUnitMode] = useState("default"); // 'default' | 'quantity' for units that support both
  // Items available for current selection in this modal
  const [modalItems, setModalItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  // Special Item attachment state
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentBase64, setAttachmentBase64] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileInputRef = useRef(null);

  // Special Item new item creation state
  const [newItemName, setNewItemName] = useState("");
  const [newItemRate, setNewItemRate] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const parseDimension = (label, raw, allowed) => {
    if (!allowed) return { value: null, expr: null, error: null };
    const result = parseDimensionInput(raw);
    if (result.error) return { ...result, error: `${label} equation is invalid.` };
    return result;
  };

  const addLine = async (e) => {
    e.preventDefault();
    let finalItemId = form.item_id;
    const unitForCheck = activeTab === 'special' ? newItemUnit : selectedUnit;
    const allowed = allowedInputsForUnit(unitForCheck, unitMode);
    const noUnitsResult = parseDimension("No. of units", form.no_of_units, allowed.includes("no_of_units"));
    const lengthResult = parseDimension("Length", form.length, allowed.includes("length"));
    const widthResult = parseDimension("Width", form.width, allowed.includes("width"));
    const thicknessResult = parseDimension("Thickness", form.thickness, allowed.includes("thickness"));
    const dimensionError = noUnitsResult.error || lengthResult.error || widthResult.error || thicknessResult.error;
    if (dimensionError) {
      setSubmitError(dimensionError);
      return;
    }

    if (activeTab === 'special') {
      if (!selectedDivisionId) {
        setSubmitError('Division is required for Special Item.');
        return;
      }
      if (!newItemName) {
        setSubmitError('Item Description is required for Special Item.');
        return;
      }
      if (!attachmentBase64) {
        setSubmitError('Attachment is required for Special Item.');
        return;
      }

      // Default attachment name to filename if not provided
      let finalAttachmentName = (attachmentName || '').trim();
      if (!finalAttachmentName && selectedFileName) {
          finalAttachmentName = selectedFileName;
      }

      try {
        setIsSubmitting(true);
        setSubmitError("");
        setSubmitNotice("");
        await createSpecialItemRequest(estimationId, {
          division_id: parseInt(selectedDivisionId),
          item_description: newItemName,
          unit: newItemUnit || null,
          rate: newItemRate ? parseFloat(newItemRate) : null,
          region: selectedRegion || region || "Default",
          organization: selectedOrganizationName || "RHD",
          attachment_name: finalAttachmentName || null,
          attachment_base64: attachmentBase64,
          sub_description: form.sub_description || null,
          no_of_units: noUnitsResult.value ?? 1,
          no_of_units_expr: noUnitsResult.expr,
          length: lengthResult.value,
          width: widthResult.value,
          thickness: thicknessResult.value,
          length_expr: lengthResult.expr,
          width_expr: widthResult.expr,
          thickness_expr: thicknessResult.expr,
          quantity: form.quantity ? parseFloat(form.quantity) : null,
        });
        setNewItemName("");
        setNewItemRate("");
        setNewItemUnit("");
        setAttachmentName("");
        setAttachmentBase64("");
        setSelectedFileName("");
        setSubmitNotice("Special item submitted for approval.");
        onRequestSubmitted?.();
        onSave();
      } catch (err) {
        setSubmitError('Failed to submit special item: ' + (err?.response?.data?.detail || err.message));
      } finally {
        setIsSubmitting(false);
      }
      if (keepOpen) {
        setForm((f) => ({ ...f }));
      } else {
        onClose();
      }
      return;
    } else {
        if (!form.item_id) return;
    }

    const sanitize = (key, val) => (allowed.includes(key) ? val : null);

    const payload = {
      item_id: parseInt(finalItemId),
      sub_description: form.sub_description || null,
      no_of_units: noUnitsResult.value ?? 1,
      no_of_units_expr: noUnitsResult.expr,
      length: lengthResult.value,
      width: widthResult.value,
      thickness: thicknessResult.value,
      length_expr: lengthResult.expr,
      width_expr: widthResult.expr,
      thickness_expr: thicknessResult.expr,
      quantity: sanitize('quantity', form.quantity ? parseFloat(form.quantity) : null),
      attachment_name: null,
      attachment_base64: null,
    };

    try {
      setIsSubmitting(true);
      setSubmitError("");
      setSubmitNotice("");
      await createEstimationLine(estimationId, payload);
      onSave();
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to add line. Please check inputs.';
      setSubmitError(msg);
      return;
    } finally {
      setIsSubmitting(false);
    }
    
    try {
      if (form.item_id) localStorage.setItem(`lastLineByItem:${region}:${form.item_id}` , JSON.stringify(form));
    } catch {}
    if (keepOpen) {
      setForm((f) => ({ ...f }));
    } else {
      onClose();
    }
  };

  // Key handling: Esc closes, Enter submits form
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        const formEl = document.getElementById('add-line-form');
        if (formEl) {
          e.preventDefault();
          if (formEl.requestSubmit) formEl.requestSubmit(); else formEl.submit();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Load presets when item or region changes
  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem(`linePresets:${region}`) || '{}');
      setPresets(all[form.item_id] || []);
    } catch { setPresets([]); }
  }, [form.item_id, region]);

  // When division changes, clear item selection
  useEffect(() => {
    setForm(f => ({ ...f, item_id: "" }));
    setSelectedUnit("");
  }, [selectedDivisionId]);

  // Keep items in the modal synced with current Organization/Region/Division selection
  useEffect(() => {
    const syncItems = async () => {
      try {
        const orgIsRHD = normalizeOrg(selectedOrganizationName) === 'RHD';
        const targetRegion = orgIsRHD ? (region || '') : (selectedRegion || '');
        // Filter from parent cache first
        const fromCache = (items || [])
          .filter(it => String(it.division_id) === String(selectedDivisionId))
          .filter(it => normalizeOrg(it.organization) === normalizeOrg(selectedOrganizationName))
          .filter(it => !it.special_item) // Filter out special items
          .filter(it => {
            if (!targetRegion) return true;
            return canonRegion(it.region) === canonRegion(targetRegion);
          });
        if (fromCache.length > 0) {
          setModalItems(fromCache);
          return;
        }
        // If no cache match, fetch from backend scoped to org/region
        setItemsLoading(true);
        const params = { limit: 1000000 };
        if (targetRegion) params.region = targetRegion;
        if (selectedOrganizationName) params.organization = selectedOrganizationName;
        const fetched = await listItems(params);
        const scoped = (fetched || [])
          .filter(it => String(it.division_id) === String(selectedDivisionId))
          .filter(it => !it.special_item); // Filter out special items
        setModalItems(scoped);
      } catch (e) {
        console.error('Failed to load items for selection', e);
        setModalItems([]);
      } finally {
        setItemsLoading(false);
      }
    };
    if (selectedDivisionId && selectedOrganizationName && activeTab === 'standard') {
      syncItems();
    } else {
      setModalItems([]);
    }
  }, [items, selectedDivisionId, selectedOrganizationName, selectedRegion, region, activeTab]);

  const applyLastForItem = () => {
    try {
      const raw = localStorage.getItem(`lastLineByItem:${region}:${form.item_id}`);
      if (!raw) return;
      const tmpl = JSON.parse(raw);
      setForm({ ...form, ...tmpl, item_id: form.item_id });
    } catch {}
  };

  const savePreset = () => {
    if (!presetName || !form.item_id) return;
    const preset = {
      id: String(Date.now()),
      name: presetName,
      sub_description: form.sub_description || "",
      no_of_units: form.no_of_units || 1,
      length: form.length || "",
      width: form.width || "",
      thickness: form.thickness || "",
      quantity: form.quantity || "",
    };
    try {
      const key = `linePresets:${region}`;
      const all = JSON.parse(localStorage.getItem(key) || '{}');
      const arr = all[form.item_id] || [];
      const next = [...arr, preset];
      all[form.item_id] = next;
      localStorage.setItem(key, JSON.stringify(all));
      setPresets(next);
      setPresetName("");
    } catch {}
  };

  const applyPreset = () => {
    const p = presets.find((x) => x.id === selectedPresetId);
    if (!p) return;
    setForm({
      item_id: form.item_id,
      sub_description: p.sub_description,
      no_of_units: p.no_of_units,
      length: p.length,
      width: p.width,
      thickness: p.thickness,
      quantity: p.quantity,
    });
  };

  // Allowed input rules by unit
  const supportsDualMode = (unit) => {
    const u = String(unit || '').toLowerCase();
    const norm = u.replace(/[^a-z0-9]/g, '');
    const isCubic = norm.includes('cumeter') || norm.includes('m3') || norm.includes('cubic');
    const isSquare = norm.includes('sqmeter') || norm.includes('sqm') || norm.includes('m2') || norm.includes('square');
    return isCubic || isSquare;
  };
  const allowedInputsForUnit = (unit, mode) => {
    const u = String(unit || '').toLowerCase();
    const norm = u.replace(/[^a-z0-9]/g, '');
    const isCubic = norm.includes('cumeter') || norm.includes('m3') || norm.includes('cubic');
    const isSquare = norm.includes('sqmeter') || norm.includes('sqm') || norm.includes('m2') || norm.includes('square');
    const isLinear = !isCubic && !isSquare && (norm.includes('linm') || norm.includes('rm') || norm.includes('meter'));
    if (isCubic) {
      return mode === 'quantity' ? ['no_of_units','quantity'] : ['no_of_units','length','width','thickness'];
    } else if (isSquare) {
      return mode === 'quantity' ? ['no_of_units','quantity'] : ['no_of_units','length','width'];
    } else if (isLinear) {
      return ['no_of_units','length'];
    } else {
      return ['no_of_units','quantity'];
    }
  };

  const unitForInputs = activeTab === 'special' ? newItemUnit : selectedUnit;
  const allowedInputs = allowedInputsForUnit(unitForInputs, unitMode);

  return (
    <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto z-50 relative border border-gray-200">
        <button onClick={onClose} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h3 className="text-lg sm:text-xl font-semibold mb-4 text-gray-900">Add New Line</h3>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium focus:outline-none ${activeTab === 'standard' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('standard')}
          >
            Add Item
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium focus:outline-none ${activeTab === 'special' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('special')}
          >
            Add Special Item
          </button>
        </div>

        {(selectedRegion || region) && (
          <p className="mb-3 text-xs text-gray-600">Showing items for region: <span className="font-medium">{selectedRegion || region}</span></p>
        )}
        <form id="add-line-form" onSubmit={addLine} className="grid grid-cols-1 gap-3 mt-2">
          {/* Organization first */}
          <div>
            <label className="text-xs text-gray-700">Organization</label>
            <select
              value={selectedOrganizationName}
              onChange={(e)=>{ setSelectedOrganizationName(e.target.value); setForm(f=>({...f, item_id: ""})); setSelectedUnit(""); }}
              className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
            >
              <option value="">Select Organization</option>
              {organizations.map(o => (
                <option key={o.org_id} value={o.name}>{o.name}</option>
              ))}
            </select>
          </div>
          {/* Region (enabled only for non-RHD organizations) */}
          <div>
            <label className="text-xs text-gray-700">Region</label>
            <select
              value={selectedRegion}
              onChange={(e)=>{ setSelectedRegion(e.target.value); setForm(f=>({...f, item_id: ""})); setSelectedUnit(""); }}
              disabled={normalizeOrg(selectedOrganizationName) === 'RHD'}
              className={`border ${normalizeOrg(selectedOrganizationName) === 'RHD' ? 'opacity-60 cursor-not-allowed' : ''} border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs`}
            >
              <option value="">Select Region</option>
              {orgRegions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {/* Division first */}
          <select value={selectedDivisionId} onChange={(e)=>setSelectedDivisionId(e.target.value)} className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs">
            <option value="">Select Division</option>
            {divisions.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {/* Item filtered by division */}
          {activeTab === 'special' ? (
             <div className="grid grid-cols-1 gap-2">
                <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Item Name / Description"
                    className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                />
                 <div className="grid grid-cols-2 gap-2">
                    <input
                        type="number"
                        value={newItemRate}
                        onChange={(e) => setNewItemRate(e.target.value)}
                        placeholder="Rate"
                        className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                    />
                     <input
                        type="text"
                        value={newItemUnit}
                        onChange={(e) => setNewItemUnit(e.target.value)}
                        placeholder="Unit (e.g. LS, m2)"
                        className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                    />
                </div>
            </div>
          ) : (
            <select
              name="item_id"
              value={form.item_id}
              onChange={(e)=>{
                const id = e.target.value;
                setForm({ ...form, item_id: id });
                const it = modalItems.find(x => String(x.item_id) === String(id));
                const unit = it?.unit || "";
                setSelectedUnit(unit);
                setUnitMode(supportsDualMode(unit) ? 'default' : 'default');
              }}
              disabled={!selectedDivisionId || !selectedOrganizationName}
              className={`border ${(!selectedDivisionId || !selectedOrganizationName) ? 'opacity-60 cursor-not-allowed' : ''} border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs`}
            >
              <option value="">Select Item</option>
              {modalItems
                .map(it => (
                  <option key={it.item_id} value={it.item_id}>{it.item_code} — {it.item_description}</option>
                ))}
            </select>
          )}
          {/* Unit + mode */}
          {(form.item_id || activeTab === 'special') && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="text-gray-800"><span className="font-semibold text-sm">Unit:</span> <span className="font-bold text-sm">
                  {activeTab === 'special' ? (newItemUnit || '—') : (selectedUnit || '—')}
              </span></div>
              {supportsDualMode(selectedUnit) && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Calculation:</span>
                  <div className="inline-flex rounded overflow-hidden border border-gray-300">
                    <button type="button" className={`px-2 py-1 ${unitMode==='default'?'bg-teal-600 text-white':'bg-white text-gray-700'}`} onClick={()=>setUnitMode('default')}>Dimensions</button>
                    <button type="button" className={`px-2 py-1 ${unitMode==='quantity'?'bg-teal-600 text-white':'bg-white text-gray-700'}`} onClick={()=>setUnitMode('quantity')}>Quantity</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'standard' && form.item_id && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
              <div className="flex items-center gap-2">
                <button type="button" onClick={applyLastForItem} className="text-xs px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 border">Use last for item</button>
              </div>
              <div className="flex items-center gap-2">
                <select value={selectedPresetId} onChange={(e)=>setSelectedPresetId(e.target.value)} className="text-xs border p-2 rounded w-full">
                  <option value="">Apply preset…</option>
                  {presets.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
                <button type="button" onClick={applyPreset} className="text-xs px-3 py-2 rounded bg-teal-600 text-white">Apply</button>
              </div>
              <div className="flex items-center gap-2">
                <input value={presetName} onChange={(e)=>setPresetName(e.target.value)} placeholder="Save as preset name" className="text-xs border p-2 rounded w-full" />
                <button type="button" onClick={savePreset} className="text-xs px-3 py-2 rounded bg-gray-800 text-white">Save</button>
              </div>
            </div>
          )}
          <input name="sub_description" value={form.sub_description} onChange={handleChange} placeholder="Sub Division / Sub Description" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />

          {/* Inputs governed by unit rules */}
          {allowedInputs.includes('no_of_units') && (
            <input name="no_of_units" value={form.no_of_units} onChange={handleChange} placeholder="Nos" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
          )}
          {allowedInputs.includes('quantity') && (
            <input name="quantity" value={form.quantity} onChange={handleChange} placeholder="Quantity" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
          )}
          {allowedInputs.includes('length') && (
            <input name="length" value={form.length} onChange={handleChange} placeholder="Length" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
          )}
          {allowedInputs.includes('width') && (
            <input name="width" value={form.width} onChange={handleChange} placeholder="Width" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
          )}
          {allowedInputs.includes('thickness') && (
            <input name="thickness" value={form.thickness} onChange={handleChange} placeholder="Thickness/Depth" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
          )}
          {/* Attachment inputs for Special Item division */}
          {activeTab === 'special' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <input
                type="text"
                value={attachmentName}
                onChange={(e)=>setAttachmentName(e.target.value)}
                placeholder="Attachment Name (e.g., A-01)"
                className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
              />
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="*/*"
                  onChange={(e)=>{
                    const file = e.target.files?.[0];
                    if (!file) { setAttachmentBase64(''); setSelectedFileName(''); return; }
                    setSelectedFileName(file.name);
                    const reader = new FileReader();
                    reader.onload = () => {
                      const result = reader.result;
                      if (typeof result === 'string') {
                        const b64 = result.includes(',') ? result.split(',')[1] : result;
                        setAttachmentBase64(b64);
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  className="text-xs px-3 py-2 rounded bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:from-rose-600 hover:to-pink-700"
                >
                  Upload Attachment
                </button>
                <span className="text-[11px] text-gray-600 truncate max-w-[160px]" title={selectedFileName}>
                  {selectedFileName || 'No file selected'}
                </span>
              </div>
            </div>
          )}
          {submitError && (
            <div className="text-xs text-red-600">{submitError}</div>
          )}
          {submitNotice && (
            <div className="text-xs text-emerald-700">{submitNotice}</div>
          )}
          <div className="mt-2 flex justify-between items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" checked={keepOpen} onChange={(e)=>setKeepOpen(e.target.checked)} />
              Keep form open after Add
            </label>
            <button
              type="button"
              onClick={onClose}
              className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''} bg-teal-700 hover:bg-teal-900 text-white font-medium py-1 px-3 rounded inline-flex items-center gap-1 text-xs`}
            >
              {isSubmitting ? 'Adding…' : (activeTab === 'special' ? 'Submit Item' : 'Add Line')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditLineModal({ line, onClose, onSave }) {
  const [editForm, setEditForm] = useState({
    sub_description: line.sub_description || "",
    no_of_units: getInitialDimensionValue(line.no_of_units_expr, line.no_of_units),
    length: getInitialDimensionValue(line.length_expr, line.length),
    width: getInitialDimensionValue(line.width_expr, line.width),
    thickness: getInitialDimensionValue(line.thickness_expr, line.thickness),
    quantity: line.quantity || "",
  });
  const [submitError, setSubmitError] = useState("");

  const handleChange = (e) => setEditForm({ ...editForm, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    const noUnitsResult = parseDimensionInput(editForm.no_of_units);
    const lengthResult = parseDimensionInput(editForm.length);
    const widthResult = parseDimensionInput(editForm.width);
    const thicknessResult = parseDimensionInput(editForm.thickness);
    const dimensionError = noUnitsResult.error || lengthResult.error || widthResult.error || thicknessResult.error;
    if (dimensionError) {
      setSubmitError(dimensionError);
      return;
    }
    setSubmitError("");
    const payload = {
      item_id: line.item_id, // item_id is not editable
      sub_description: editForm.sub_description || null,
      no_of_units: noUnitsResult.value ?? 1,
      no_of_units_expr: noUnitsResult.expr,
      length: lengthResult.value,
      width: widthResult.value,
      thickness: thicknessResult.value,
      length_expr: lengthResult.expr,
      width_expr: widthResult.expr,
      thickness_expr: thicknessResult.expr,
      quantity: editForm.quantity ? parseFloat(editForm.quantity) : null,
    };
    onSave(payload);
  };

  // Key handling: Esc closes, Enter submits form
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        const formEl = document.getElementById('edit-line-form');
        if (formEl) {
          e.preventDefault();
          if (formEl.requestSubmit) formEl.requestSubmit(); else formEl.submit();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto z-50 relative border border-gray-200">
        <button onClick={onClose} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Edit Line</h3>
        <p className="mb-2 text-xs text-gray-600">Item: {line.item.item_code} — {line.item.item_description}</p>
        <p className="mb-3 text-xs text-gray-600">Rate: {line.rate} (fixed)</p>
        {submitError && <div className="mb-2 text-xs text-red-600">{submitError}</div>}
        <form id="edit-line-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 mt-2">
          <input name="sub_description" value={editForm.sub_description} onChange={handleChange} placeholder="Sub description" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
          <input name="no_of_units" value={editForm.no_of_units} onChange={handleChange} placeholder="No. of units" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
          <input name="quantity" value={editForm.quantity} onChange={handleChange} placeholder="Quantity (direct)" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
          <input name="length" value={editForm.length} onChange={handleChange} placeholder="Length" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
          <input name="width" value={editForm.width} onChange={handleChange} placeholder="Width" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
          <input name="thickness" value={editForm.thickness} onChange={handleChange} placeholder="Thickness" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-teal-700 hover:bg-teal-900 text-white font-medium py-1 px-3 rounded inline-flex items-center gap-1 text-xs"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmDeleteLinesModal({ selectedIds, lines, onClose, onConfirm }) {
  // Key handling: Esc closes, Enter confirms delete
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onConfirm]);

  const count = selectedIds.length;
  const single = count === 1;
  const line = single ? lines.find(l => l.line_id === selectedIds[0]) : null;

  return (
    <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-md z-50 relative border border-gray-200">
        <button onClick={onClose} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Confirm Delete</h3>
        {single ? (
          <p className="mb-3 text-xs text-gray-700">You are about to delete 1 line: <span className="font-medium">{line?.item?.item_code} — {line?.item?.item_description}</span>. This action cannot be undone.</p>
        ) : (
          <p className="mb-3 text-xs text-gray-700">You are about to delete {count} selected lines. This action cannot be undone.</p>
        )}
        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold py-1 px-3 rounded shadow-sm text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white font-medium py-1 px-3 rounded inline-flex items-center gap-1 text-xs"
          >
            Delete {single ? 'Line' : 'Lines'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LineDetailModal({ line, onClose }) {
  return (
    <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto z-50 relative border border-gray-200">
        <button onClick={onClose} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Line Detail</h3>
        <div className="text-xs text-gray-800 space-y-2">
          <div><span className="text-gray-600">Item:</span> <span className="font-medium">{line?.item?.item_code} — {line?.item?.item_description}</span></div>
          <div><span className="text-gray-600">Division:</span> {line?.item?.division?.name || '—'}</div>
          <div><span className="text-gray-600">Rate:</span> {line?.rate} {line?.item?.unit ? `(${line?.item?.unit})` : ''}</div>
          <div><span className="text-gray-600">Sub description:</span> {line?.sub_description || '—'}</div>
          {line?.attachment_name && (
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Attachment:</span>
              <span className="font-medium">{line.attachment_name}</span>
              <a
                href={`data:application/octet-stream;base64,${line.attachment_base64}`}
                download={line.attachment_name}
                className="px-2 py-1 rounded text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700"
              >
                Download
              </a>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-gray-600">No. of units:</span> {line?.no_of_units ?? '—'}</div>
            <div><span className="text-gray-600">Quantity (direct):</span> {line?.quantity ?? '—'}</div>
            <div><span className="text-gray-600">Length:</span> {line?.length ?? '—'}</div>
            <div><span className="text-gray-600">Width:</span> {line?.width ?? '—'}</div>
            <div><span className="text-gray-600">Thickness:</span> {line?.thickness ?? '—'}</div>
            <div><span className="text-gray-600">Calculated Qty:</span> {line?.calculated_qty ?? '—'}</div>
          </div>
          <div><span className="text-gray-600">Amount:</span> <span className="font-semibold">{line?.amount ?? '—'}</span></div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs">Close</button>
        </div>
      </div>
    </div>
  );
}
