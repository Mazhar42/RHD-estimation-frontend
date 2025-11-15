import React, { useEffect, useState, useRef } from "react";
import { FaPlus, FaTrash, FaEdit, FaFileExcel, FaFileCsv, FaUpload, FaFilePdf } from "react-icons/fa";
import axios from "axios";
import { useParams, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API = import.meta.env.VITE_API_BASE || "https://rhd-estimation-backend.onrender.com";

export default function EstimationDetail() {
  const { estimationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lines, setLines] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
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
  const [importMode, setImportMode] = useState("append");
  const [importBanner, setImportBanner] = useState(null); // { type: 'success'|'warning'|'error', message: string }
  const downloadMenuRef = useRef(null);

  const submitImportLines = async () => {
    if (!importFile) {
      setImportError('Please select a CSV or XLSX file.');
      return;
    }
    try {
      setIsImporting(true);
      const filename = importFile.name || '';
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      if (ext !== 'xlsx' && ext !== 'xlsm') {
        setImportError('Only .xlsx files are allowed.');
        setIsImporting(false);
        return;
      }
      // Optional replace: clear existing lines
      if (importMode === 'replace' && lines.length) {
        const allIds = lines.map(l => l.line_id);
        await axios.delete(`${API}/estimations/lines`, { data: { line_ids: allIds } });
      }

      const reader = new FileReader();
      const fileArrayBuffer = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(importFile);
      });
      const wb = XLSX.read(fileArrayBuffer, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });

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

      // Start parsing below header if found; else scan entire sheet
      const startIdx = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
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

        // Find item by code or description
        const item = findItemForRow(codeCell, descCell);
        if (!item) { skippedCount++; missingItemCount++; continue; }

        const payload = {
          item_id: item.item_id,
          sub_description: String(subDescCell || ''),
          no_of_units: parseNum(noUnitsCell) ?? 1,
          length: parseNum(lengthCell),
          width: parseNum(widthCell),
          thickness: parseNum(thicknessCell),
          quantity: parseNum(quantityCell),
        };

        try {
          await axios.post(`${API}/estimations/${estimationId}/lines`, payload);
          importedCount++;
        } catch (e) {
          console.error('Failed to import row', e);
          skippedCount++;
          apiErrorCount++;
        }
      }

      await fetchLines();
      setIsImporting(false);
      // Prepare banner and inline message
      if (importedCount === 0) {
        const reason = missingItemCount ? `No matching items found for ${missingItemCount} row(s)` : 'Import encountered errors';
        setImportError(`Could not import any rows. ${reason}.`);
        setImportBanner({ type: 'error', message: `Import failed: ${reason}. Check region selection and item codes/descriptions.` });
      } else {
        const details = skippedCount ? `Imported ${importedCount}, skipped ${skippedCount} (missing items: ${missingItemCount}${apiErrorCount ? `, API errors: ${apiErrorCount}` : ''}).` : `Imported ${importedCount} row(s).`;
        setImportBanner({ type: skippedCount ? 'warning' : 'success', message: details });
        setIsImportModalOpen(false);
        setImportFile(null);
        setImportError("");
      }
    } catch (err) {
      console.error('Import failed:', err);
      const msg = err?.response?.data?.detail || 'Import failed. Please check the file format and try again.';
      setImportError(msg);
      setIsImporting(false);
      setImportBanner({ type: 'error', message: msg });
    }
  };

  // Auto-hide banner after a while
  useEffect(() => {
    if (!importBanner) return;
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
    // Fetch items initially to populate available regions and items list
    fetchItems(resolved);
    fetchLines();
  }, [estimationId]);

  const fetchItems = async (regionFilter) => {
    try {
      const params = { limit: 10000 };
      const reg = regionFilter ?? region;
      if (reg) params.region = reg;
      const res = await axios.get(`${API}/items`, { params });
      setItems(res.data);
      const uniqueRegs = Array.from(new Set(res.data.map(it => it.region))).filter(Boolean).sort();
      setAvailableRegions(uniqueRegs);
    } catch (e) {
      console.error('Failed to fetch items', e);
    }
  };

  const fetchLines = async () => {
    const res = await axios.get(`${API}/estimations/${estimationId}/lines`);
    setLines(res.data);
    const tot = await axios.get(`${API}/estimations/${estimationId}/total`);
    setTotal(tot.data.grand_total);
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
      await axios.delete(`${API}/estimations/lines`, { data: { line_ids: selectedLineIds } });
      fetchLines();
      setSelectedLineIds([]);
      setIsDeleteLinesModalOpen(false);
    } catch (error) {
      console.error("Failed to delete lines", error);
      alert("Failed to delete lines.");
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
      await axios.put(`${API}/estimations/lines/${editingLine.line_id}`, updatedLineData);
      setIsEditModalOpen(false);
      setEditingLine(null);
      fetchLines();
      setSelectedLineIds([]);
    } catch (error) {
      console.error("Failed to update line", error);
      alert("Failed to update line.");
    }
  };

  const downloadXlsx = () => {
    const wb = XLSX.utils.book_new();
    const grandTotal = lines.reduce((sum, line) => sum + (line.amount || 0), 0);

    let aoa = [
      ["Item Code", "Description", "Sub Desc", "No.", "Length", "Width", "Thickness", "Quantity", "Calc Qty", "Rate", "Unit", "Amount"]
    ];
    const merges = [];
    let currentRow = 0; // This is the row index in the 'aoa' array

    // Style for bold text
    const boldStyle = { font: { bold: true } };

    currentRow++; // For header row

    Object.entries(groupedLines).forEach(([divisionName, divisionLines]) => {
      // Add division name row
      aoa.push([divisionName]);
      merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 11 } });
      currentRow++;

      // Add line items
      divisionLines.forEach(l => {
        aoa.push([
          l.item?.item_code, l.item?.item_description, l.sub_description,
          l.no_of_units, l.length, l.width, l.thickness, l.quantity,
          l.calculated_qty, l.rate, l.item?.unit, l.amount
        ]);
        currentRow++;
      });

      // Add subtotal row
      const divisionSubtotal = divisionLines.reduce((sum, line) => sum + (line.amount || 0), 0);
      aoa.push(["", "", "", "", "", "", "", "", "", "", "Subtotal", divisionSubtotal]);
      currentRow++;

      // Add blank row
      aoa.push([]);
      currentRow++;
    });

    // Add grand total row
    aoa.push(["", "", "", "", "", "", "", "", "", "", "Grand Total", grandTotal]);
    
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;

    // Apply styles by iterating through the worksheet
    // Bold main headers
    for (let C = 0; C <= 11; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (ws[cellAddress]) ws[cellAddress].s = boldStyle;
    }

    let styleRow = 1; // Start after main headers
    Object.entries(groupedLines).forEach(([divisionName, divisionLines]) => {
      // Bold and center division name
      const divCellAddress = XLSX.utils.encode_cell({ r: styleRow, c: 0 });
      if (ws[divCellAddress]) ws[divCellAddress].s = { ...boldStyle, alignment: { horizontal: "center" } };
      styleRow++; // Move to first item row

      styleRow += divisionLines.length; // Move to subtotal row

      // Bold subtotal
      const subtotalCellAddress = XLSX.utils.encode_cell({ r: styleRow, c: 11 });
      if (ws[subtotalCellAddress]) ws[subtotalCellAddress].s = boldStyle;
      styleRow += 2; // Move past subtotal and blank row to the next division header
    });

    // Bold grand total
    const grandTotalCellAddress = XLSX.utils.encode_cell({ r: aoa.length - 1, c: 11 });
    if (ws[grandTotalCellAddress]) ws[grandTotalCellAddress].s = boldStyle;

    XLSX.utils.book_append_sheet(wb, ws, "Estimation");
    XLSX.writeFile(wb, `estimation_${estimationId}.xlsx`);
  };

  const downloadCsv = () => {
    const grandTotal = lines.reduce((sum, line) => sum + (line.amount || 0), 0);

    let aoa = [
      ["Item Code", "Description", "Sub Desc", "No.", "Length", "Width", "Thickness", "Quantity", "Calc Qty", "Rate", "Unit", "Amount"]
    ];

    Object.entries(groupedLines).forEach(([divisionName, divisionLines]) => {
      // Division heading
      aoa.push([divisionName]);

      // Line items
      divisionLines.forEach(l => {
        aoa.push([
          l.item?.item_code, l.item?.item_description, l.sub_description,
          l.no_of_units, l.length, l.width, l.thickness, l.quantity,
          l.calculated_qty, l.rate, l.item?.unit, l.amount
        ]);
      });

      // Subtotal row
      const divisionSubtotal = divisionLines.reduce((sum, line) => sum + (line.amount || 0), 0);
      aoa.push(["", "", "", "", "", "", "", "", "", "", "Subtotal", divisionSubtotal]);

      // Blank spacer
      aoa.push([]);
    });

    // Grand total
    aoa.push(["", "", "", "", "", "", "", "", "", "", "Grand Total", grandTotal]);

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
    const grandTotal = lines.reduce((sum, line) => sum + (line.amount || 0), 0);
    const pageMargin = { top: 60, right: 20, bottom: 40, left: 20 };

    const drawHeaderFooter = () => {
      // Header
      doc.setFontSize(12);
      doc.text(`${title} — ${region || 'No Region'}`, pageMargin.left, 30);
      // Footer with page numbers
      const str = `Page ${doc.getNumberOfPages()}`;
      doc.setFontSize(10);
      doc.text(str, doc.internal.pageSize.getWidth() - pageMargin.right - doc.getTextWidth(str), doc.internal.pageSize.getHeight() - 20);
    };

    const pageHeight = doc.internal.pageSize.getHeight();
    const usableBottom = pageHeight - pageMargin.bottom;

    // Flow divisions one after another; add a page only if needed
    let currentY = pageMargin.top;
    Object.entries(groupedLines).forEach(([divisionName, divisionLines], idx) => {
      // If not enough space for a heading, add a page
      if (currentY > usableBottom - 30) {
        doc.addPage();
        drawHeaderFooter();
        currentY = pageMargin.top;
      }

      // Division heading
      doc.setFontSize(11);
      doc.text(`Division: ${divisionName}`, pageMargin.left, currentY - 12);

      const body = divisionLines.map(l => [
        l.item?.item_code || '',
        l.item?.item_description || '',
        l.sub_description || '',
        l.no_of_units ?? '',
        l.length ?? '',
        l.width ?? '',
        l.thickness ?? '',
        l.quantity ?? '',
        l.calculated_qty ?? '',
        l.rate ?? '',
        l.item?.unit || '',
        l.amount ?? '',
      ]);
      const divisionSubtotal = divisionLines.reduce((sum, line) => sum + (line.amount || 0), 0);

      autoTable(doc, {
        startY: currentY,
        margin: pageMargin,
        head: [[
          'Item Code','Description','Sub Desc','No.','Length','Width','Thickness','Quantity','Calc Qty','Rate','Unit','Amount'
        ]],
        body,
        foot: [['Subtotal','','','','','','','','','','', divisionSubtotal.toFixed(2)]],
        styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: [22,160,133], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 140 },
          2: { cellWidth: 110 },
          3: { cellWidth: 35, halign: 'right' },
          4: { cellWidth: 45, halign: 'right' },
          5: { cellWidth: 45, halign: 'right' },
          6: { cellWidth: 50, halign: 'right' },
          7: { cellWidth: 55, halign: 'right' },
          8: { cellWidth: 55, halign: 'right' },
          9: { cellWidth: 50, halign: 'right' },
          10: { cellWidth: 50, halign: 'center' },
          11: { cellWidth: 70, halign: 'right' },
        },
        didDrawPage: () => drawHeaderFooter(),
      });

      // Update currentY to position next table below the finished one
      currentY = (doc.lastAutoTable?.finalY || pageMargin.top) + 30;
    });

    // Summary page
    doc.addPage();
    drawHeaderFooter();
    doc.setFontSize(18);
    doc.text('Estimation Summary', pageMargin.left, 100);
    doc.setFontSize(12);
    doc.text(`Grand Total: ${grandTotal.toFixed(2)}`, pageMargin.left, 140);
    // Division subtotals
    let y = 180;
    Object.entries(groupedLines).forEach(([divisionName, divisionLines]) => {
      const subtotal = divisionLines.reduce((sum, line) => sum + (line.amount || 0), 0);
      doc.text(`${divisionName}: ${subtotal.toFixed(2)}`, pageMargin.left, y);
      y += 22;
    });

    doc.save(`estimation_${estimationId}.pdf`);
  };

  const groupedLines = lines.reduce((acc, line) => {
    const divisionName = line.item?.division?.name || 'Uncategorized';
    if (!acc[divisionName]) {
      acc[divisionName] = [];
    }
    acc[divisionName].push(line);
    return acc;
  }, {});

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
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-xl font-semibold">{`Estimation : ${localStorage.getItem(`estimationName:${estimationId}`) || `Estimation #${estimationId}`}`}</h2>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-700">Region:</span>
            <span className="text-xs text-gray-900">{region || '—'}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsImportModalOpen(true)} className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 text-xs font-medium py-1 px-3 rounded inline-flex items-center gap-1">
              <FaUpload className="w-3 h-3" />
              <span>Import</span>
            </button>
            <button onClick={() => setIsAddLineModalOpen(true)} className="bg-teal-700 hover:bg-teal-900 text-white text-xs font-extralight py-1 px-4 rounded inline-flex items-center gap-1">
              <FaPlus className="w-3 h-3" />
              <span>Add Line</span>
            </button>
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
      </div>

      {selectedLineIds.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <div className="text-xs">{selectedLineIds.length} selected line(s)</div>
          {selectedLineIds.length === 1 ? (
            <>
              <button className="bg-gray-200 text-gray-900 text-xs px-3 py-1 rounded" onClick={openLineDetail}>Line Detail</button>
              <button className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-3 py-1 rounded" onClick={openEditModal}>Edit</button>
              <button className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded" onClick={openDeleteLinesModal}>Delete</button>
              <button className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-3 py-1 rounded" onClick={clearSelection}>Clear selection</button>
            </>
          ) : (
            <>
              <button className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded" onClick={openDeleteLinesModal}>Delete</button>
              <button className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-3 py-1 rounded" onClick={clearSelection}>Clear selection</button>
            </>
          )}
        </div>
      )}

      

      {Object.entries(groupedLines).map(([divisionName, divisionLines]) => {
        const divisionSubtotal = divisionLines.reduce((sum, line) => sum + (line.amount || 0), 0);
        return (
          <div key={divisionName} className="mb-8">
            <h3 className="text-md font-semibold mb-2 bg-gray-200 p-2 rounded">{divisionName}</h3>
            <div className="border rounded-lg flex flex-col border-gray-200">
              <div className="overflow-x-auto w-full">
                <div className="max-h-[75vh] overflow-auto">
                  <table className="min-w-full border-collapse table-fixed">
                    <thead className="sticky top-0 z-10 bg-gray-100 border-b-2 border-gray-200">
                      <tr>
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
                        <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Item Code</th>
                        <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Description</th>
                        <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Sub Desc</th>
                        <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">No.</th>
                        <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Length</th>
                        <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Width</th>
                        <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Thickness</th>
                        <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Quantity</th>
                        <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Calc Qty</th>
                        <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Rate</th>
                        <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Unit</th>
                        <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {divisionLines.map((l, i) => (
                        <tr key={l.line_id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-teal-50 transition-colors ${selectedLineIds.includes(l.line_id) ? 'bg-teal-100' : ''}`}>
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selectedLineIds.includes(l.line_id)}
                              onChange={() => handleSelectLine(l.line_id)}
                            />
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{l.item?.item_code}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{l.item?.item_description}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{l.sub_description}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{l.no_of_units}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{l.length}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{l.width}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{l.thickness}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{l.quantity}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{l.calculated_qty}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{l.rate}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{l.item?.unit}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{l.amount}</td>
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

      <div className="flex justify-end mt-4">
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-teal-50 to-emerald-50 text-teal-900 border border-teal-200 rounded-lg px-4 py-2 shadow-sm">
          <span className="text-sm font-semibold">Grand Total</span>
          <span className="text-xl font-bold">{formatAmount(total)}</span>
        </div>
      </div>

      {isAddLineModalOpen && (
        <AddLineModal
          items={items}
          onClose={() => setIsAddLineModalOpen(false)}
          onSave={fetchLines}
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
          <ImportModal
            isImporting={isImporting}
            importError={importError}
            importFile={importFile}
            importMode={importMode}
            onClose={() => setIsImportModalOpen(false)}
            onFile={(f)=>setImportFile(f)}
            onMode={(m)=>setImportMode(m)}
            onImport={submitImportLines}
            setError={setImportError}
          />
        </div>
      )}
    </div>
  );
}

function ImportModal({ isImporting, importError, importFile, importMode, onClose, onFile, onMode, onImport, setError }) {
  // Keyboard shortcuts: Esc to close, Enter to import
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!isImporting && importFile) onImport();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onImport, isImporting, importFile]);

  const onChoose = (file) => {
    onFile(file);
    if (!file) { setError(''); return; }
    const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
    if (ext !== 'xlsx' && ext !== 'xlsm') {
      setError('Only .xlsx files are allowed.');
    } else {
      setError('');
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0] || null;
    onChoose(f);
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-lg z-50 relative border border-gray-200" role="document">
      <button onClick={onClose} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition" aria-label="Close import modal">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
      <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Import Estimation Lines</h3>
      <p className="text-xs text-gray-600 mb-3">Upload an XLSX based on the Estimation export or template. The importer matches by Item Code, or if missing, by exact Item Description.</p>

      <div
        className="mt-2 mb-4 border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center bg-gray-50 hover:bg-gray-100 cursor-pointer"
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => document.getElementById('import-file-input')?.click()}
      >
        <input
          id="import-file-input"
          type="file"
          accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,.xlsm"
          className="hidden"
          onChange={(e) => onChoose(e.target.files?.[0] || null)}
        />
        <div className="text-xs text-gray-700">Drag & drop your XLSX here, or</div>
        <button type="button" className="mt-2 text-xs px-3 py-1 rounded bg-teal-600 text-white">Browse file</button>
        {importFile && (
          <div className="mt-3 text-xs text-gray-800">Selected: <span className="font-medium">{importFile.name}</span></div>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <label className="text-xs text-gray-700">Mode:</label>
        <select value={importMode} onChange={(e)=>onMode(e.target.value)} className="text-xs border p-2 rounded">
          <option value="append">Append</option>
          <option value="replace">Replace existing</option>
        </select>
      </div>

      {importError && (
        <div className="text-xs mb-3 p-2 rounded border bg-orange-50 text-orange-700 border-orange-300">
          {importError}
        </div>
      )}

      <div className="mt-2 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs"
        >
          Cancel (Esc)
        </button>
        <button
          type="button"
          onClick={onImport}
          disabled={isImporting || !importFile}
          className="bg-teal-700 hover:bg-teal-900 text-white font-medium py-1 px-3 rounded inline-flex items-center gap-1 text-xs disabled:bg-gray-400"
        >
          {isImporting ? 'Importing…' : 'Import (Enter)'}
        </button>
      </div>
    </div>
  );
}

function AddLineModal({ items, onClose, onSave, estimationId, region }) {
  const [form, setForm] = useState({ item_id: "", sub_description: "", no_of_units: 1, length: "", width: "", thickness: "", quantity: "" });
  const [keepOpen, setKeepOpen] = useState(true);
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetName, setPresetName] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const addLine = async (e) => {
    e.preventDefault();
    if (!form.item_id) return;
    const payload = {
      item_id: parseInt(form.item_id),
      sub_description: form.sub_description || null,
      no_of_units: parseInt(form.no_of_units || 1),
      length: form.length ? parseFloat(form.length) : null,
      width: form.width ? parseFloat(form.width) : null,
      thickness: form.thickness ? parseFloat(form.thickness) : null,
      quantity: form.quantity ? parseFloat(form.quantity) : null
    };
    await axios.post(`${API}/estimations/${estimationId}/lines`, payload);
    onSave();
    // remember last template for this item + region
    try {
      localStorage.setItem(`lastLineByItem:${region}:${form.item_id}` , JSON.stringify(form));
    } catch {}
    if (keepOpen) {
      // leave modal open and keep values for quick repeat
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

  return (
    <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-xl z-50 relative border border-gray-200">
        <button onClick={onClose} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Add New Line</h3>
        {region && (
          <p className="mb-3 text-xs text-gray-600">Showing items for region: <span className="font-medium">{region}</span></p>
        )}
        <form id="add-line-form" onSubmit={addLine} className="grid grid-cols-1 gap-3 mt-2">
          <select name="item_id" value={form.item_id} onChange={handleChange} className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs">
            <option value="">Select Item</option>
            {items.map(it => <option key={it.item_id} value={it.item_id}>{it.item_code} — {it.item_description}</option>)}
          </select>
          {form.item_id && (
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
          <input name="sub_description" value={form.sub_description} onChange={handleChange} placeholder="Sub description" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
          <input name="no_of_units" value={form.no_of_units} onChange={handleChange} placeholder="No. of units" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
          <input name="quantity" value={form.quantity} onChange={handleChange} placeholder="Quantity (direct)" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
          <input name="length" value={form.length} onChange={handleChange} placeholder="Length" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
          <input name="width" value={form.width} onChange={handleChange} placeholder="Width" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
          <input name="thickness" value={form.thickness} onChange={handleChange} placeholder="Thickness" className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs" />
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
              className="bg-teal-700 hover:bg-teal-900 text-white font-medium py-1 px-3 rounded inline-flex items-center gap-1 text-xs"
            >
              Add Line
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
    no_of_units: line.no_of_units || 1,
    length: line.length || "",
    width: line.width || "",
    thickness: line.thickness || "",
    quantity: line.quantity || "",
  });

  const handleChange = (e) => setEditForm({ ...editForm, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      item_id: line.item_id, // item_id is not editable
      sub_description: editForm.sub_description || null,
      no_of_units: parseInt(editForm.no_of_units || 1),
      length: editForm.length ? parseFloat(editForm.length) : null,
      width: editForm.width ? parseFloat(editForm.width) : null,
      thickness: editForm.thickness ? parseFloat(editForm.thickness) : null,
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
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-xl z-50 relative border border-gray-200">
        <button onClick={onClose} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Edit Line</h3>
        <p className="mb-2 text-xs text-gray-600">Item: {line.item.item_code} — {line.item.item_description}</p>
        <p className="mb-3 text-xs text-gray-600">Rate: {line.rate} (fixed)</p>
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
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-xl z-50 relative border border-gray-200">
        <button onClick={onClose} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Line Detail</h3>
        <div className="text-xs text-gray-800 space-y-2">
          <div><span className="text-gray-600">Item:</span> <span className="font-medium">{line?.item?.item_code} — {line?.item?.item_description}</span></div>
          <div><span className="text-gray-600">Division:</span> {line?.item?.division?.name || '—'}</div>
          <div><span className="text-gray-600">Rate:</span> {line?.rate} {line?.item?.unit ? `(${line?.item?.unit})` : ''}</div>
          <div><span className="text-gray-600">Sub description:</span> {line?.sub_description || '—'}</div>
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
