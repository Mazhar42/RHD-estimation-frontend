import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { FaEdit, FaTrash, FaChevronDown, FaPlus, FaUpload } from "react-icons/fa";

const API = import.meta.env.VITE_API_BASE || "https://rhd-estimation-backend.onrender.com";
const REGION_OPTIONS = [
  "Dhaka Zone",
  "Mymensingh Zone",
  "Cumilla Zone",
  "Sylhet Zone",
  "Khulna Zone",
  "Barisal Zone",
  "Gopalganj Zone",
  "Rajshahi Zone",
  "Rangpur Zone",
  "Chattogram Zone",
];

export default function Products() {
  const [isAddDivisionModalOpen, setIsAddDivisionModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [divisions, setDivisions] = useState([]);
  const [items, setItems] = useState([]);
  const [divisionName, setDivisionName] = useState("");
  const [form, setForm] = useState({ item_code: "", item_description: "", unit: "", rate: "", division_id: "", region: "" });
  const [editItem, setEditItem] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [search, setSearch] = useState({ division: "", code: "", description: "", unit: "", rate: "", rateOperator: "==", region: "" });
  const [uniqueUnits, setUniqueUnits] = useState([]);
  const [isAddingNewUnit, setIsAddingNewUnit] = useState(false);
  const [newUnit, setNewUnit] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState("append");
  const [importFile, setImportFile] = useState(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportFocusedIndex, setExportFocusedIndex] = useState(0);
  const exportMenuContainerRef = useRef(null);
  const exportMenuRef = useRef(null);
  const [isImportDragging, setIsImportDragging] = useState(false);
  const [isMassDeleteModalOpen, setIsMassDeleteModalOpen] = useState(false);
  const [isMassDeleting, setIsMassDeleting] = useState(false);
  const massDeleteContainerRef = useRef(null);
  const [massFilterColumn, setMassFilterColumn] = useState("division");
  const [massFilterOperator, setMassFilterOperator] = useState("equals");
  const [massFilterValue, setMassFilterValue] = useState("");
  const [isMassDeleteConfirmOpen, setIsMassDeleteConfirmOpen] = useState(false);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [addDivisionError, setAddDivisionError] = useState("");
  const [addItemError, setAddItemError] = useState("");
  const [isDivisionDropdownOpen, setIsDivisionDropdownOpen] = useState(false);
  const [confirmDeleteDivisionId, setConfirmDeleteDivisionId] = useState(null);
  const [isConfirmDeleteDivisionOpen, setIsConfirmDeleteDivisionOpen] = useState(false);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState(null);
  const [isConfirmDeleteItemOpen, setIsConfirmDeleteItemOpen] = useState(false);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [uniqueRegions, setUniqueRegions] = useState([]);

  // Detect if any search filter is active
  const isSearchActive = () => {
    return Boolean(
      search.division ||
      search.code ||
      search.description ||
      search.unit ||
      search.rate ||
      search.region ||
      (search.rateOperator && search.rateOperator !== '==')
    );
  };

  // Clear all search filters to defaults
  const clearAllSearch = () => {
    setSearch({ division: "", code: "", description: "", unit: "", rate: "", rateOperator: "==", region: "" });
    setCurrentPage(1);
  };

  // Format numeric rate values to two decimal places (e.g., 337.50)
  const formatRate = (val) => {
    const num = Number(val);
    return Number.isFinite(num) ? num.toFixed(2) : '';
  };

  useEffect(() => {
    fetchDivisions();
    fetchItems();
  }, []);

  useEffect(() => {
    const units = [...new Set(items.map(item => item.unit))];
    setUniqueUnits(units);
  }, [items]);

  useEffect(() => {
    const regions = [...new Set(items.map(item => item.region).filter(Boolean))];
    setUniqueRegions(regions);
  }, [items]);

  // Keyboard shortcuts for Add Division modal: Esc to cancel, Enter to add
  useEffect(() => {
    if (!isAddDivisionModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsAddDivisionModalOpen(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        addDivision();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAddDivisionModalOpen, divisionName]);

  // Keyboard shortcuts for Add Item modal: Esc to cancel, Enter to add
  useEffect(() => {
    if (!isAddItemModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsAddItemModalOpen(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        addItem();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAddItemModalOpen, form]);

  // Keyboard shortcuts for Confirm Delete Division: Esc to cancel, Enter to delete
  useEffect(() => {
    if (!isConfirmDeleteDivisionOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsConfirmDeleteDivisionOpen(false);
        setConfirmDeleteDivisionId(null);
      } else if (e.key === "Enter") {
        e.preventDefault();
        deleteDivisionById();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isConfirmDeleteDivisionOpen, confirmDeleteDivisionId]);

  // Keyboard shortcuts for Confirm Delete Item: Esc to cancel, Enter to delete
  useEffect(() => {
    if (!isConfirmDeleteItemOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsConfirmDeleteItemOpen(false);
        setConfirmDeleteItemId(null);
      } else if (e.key === "Enter") {
        e.preventDefault();
        deleteItemById();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isConfirmDeleteItemOpen, confirmDeleteItemId]);

  // Keyboard shortcuts for Import Item modal: Esc to cancel, Enter to import, Arrows toggle mode
  useEffect(() => {
    if (!isImportModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsImportModalOpen(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleImportClick();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setImportMode('append');
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setImportMode('replace');
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isImportModalOpen, importMode, importFile, isImporting]);

  // Keyboard shortcuts and outside click for Mass Delete modal
  useEffect(() => {
    if (!isMassDeleteModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (isMassDeleteConfirmOpen) {
          setIsMassDeleteConfirmOpen(false);
        } else {
          setIsMassDeleteModalOpen(false);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (isMassDeleteConfirmOpen) {
          bulkDeleteFilteredWithProgress();
        } else {
          // open confirm if there are candidates
          const isActive = massFilterValue !== '';
          const candidates = isActive ? massFilteredItems : filteredItems;
          if (candidates.length > 0) setIsMassDeleteConfirmOpen(true);
        }
      }
    };
    const onMouseDown = (e) => {
      const container = massDeleteContainerRef.current;
      if (container && !container.contains(e.target)) {
        setIsMassDeleteModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [isMassDeleteModalOpen, isMassDeleteConfirmOpen, massFilterValue]);

  // Keyboard navigation and outside click for Export menu
  useEffect(() => {
    if (!isExportMenuOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsExportMenuOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setExportFocusedIndex((i) => (i + 1) % 2);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setExportFocusedIndex((i) => (i + 2 - 1) % 2);
      } else if (e.key === "Enter") {
        e.preventDefault();
        // 0 = CSV, 1 = XLSX
        if (exportFocusedIndex === 0) {
          setIsExportMenuOpen(false);
          exportCSV();
        } else {
          setIsExportMenuOpen(false);
          exportXLSX();
        }
      }
    };
    const onMouseDown = (e) => {
      const container = exportMenuContainerRef.current;
      if (container && !container.contains(e.target)) {
        setIsExportMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [isExportMenuOpen, exportFocusedIndex]);

  const fetchDivisions = async () => {
    const res = await axios.get(`${API}/items/divisions`);
    setDivisions(res.data);
  };
  const fetchItems = async () => {
    // Request a larger limit so the UI reflects full imports
    const res = await axios.get(`${API}/items`, { params: { limit: 10000 } });
    setItems(res.data);
  };

  const addDivision = async () => {
    if (!divisionName.trim()) {
      setAddDivisionError("Input field is empty");
      return;
    }
    await axios.post(`${API}/items/divisions`, { name: divisionName.trim() });
    setDivisionName("");
    setAddDivisionError("");
    fetchDivisions();
    setIsAddDivisionModalOpen(false);
    setToast("Division added successfully");
    setTimeout(() => setToast(null), 2500);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const addItem = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    const requiredMissing = !form.division_id || !form.item_code.trim() || !form.item_description.trim() || !form.unit || !form.region;
    if (requiredMissing) {
      setAddItemError("Input field is empty");
      return;
    }
    const payload = { ...form, rate: form.rate ? parseFloat(form.rate) : null, division_id: parseInt(form.division_id) };
    await axios.post(`${API}/items`, payload);
    setForm({ item_code: "", item_description: "", unit: "", rate: "", division_id: "", region: "" });
    setAddItemError("");
    fetchItems();
    setIsAddItemModalOpen(false);
    setToast("Item added successfully");
    setTimeout(() => setToast(null), 2500);
  };

  const requestDeleteDivision = (division_id) => {
    setConfirmDeleteDivisionId(division_id);
    setIsConfirmDeleteDivisionOpen(true);
  };

  const deleteDivisionById = async () => {
    if (!confirmDeleteDivisionId) return;
    await axios.delete(`${API}/items/divisions/${confirmDeleteDivisionId}`);
    if (String(form.division_id) === String(confirmDeleteDivisionId)) {
      setForm({ ...form, division_id: "" });
    }
    setIsConfirmDeleteDivisionOpen(false);
    setConfirmDeleteDivisionId(null);
    fetchDivisions();
    setToast("Division deleted successfully");
    setTimeout(() => setToast(null), 2500);
  };

  const requestDeleteItem = (item_id) => {
    setConfirmDeleteItemId(item_id);
    setIsConfirmDeleteItemOpen(true);
  };

  const deleteItemById = async () => {
    if (!confirmDeleteItemId) return;
    try {
      setIsDeletingItem(true);
      await axios.delete(`${API}/items/${confirmDeleteItemId}`);
      setIsConfirmDeleteItemOpen(false);
      setConfirmDeleteItemId(null);
      fetchItems();
      setToast("Item deleted successfully");
    } catch (err) {
      const message = err?.response?.data?.detail || "Failed to delete item";
      setToast(message);
    } finally {
      setIsDeletingItem(false);
      setTimeout(() => setToast(null), 2500);
    }
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setIsEditModalOpen(true);
  };

  const updateItem = async () => {
    if (!editItem) return;
    const payload = { ...editItem, rate: editItem.rate ? parseFloat(editItem.rate) : null, division_id: parseInt(editItem.division_id) };
    await axios.put(`${API}/items/${editItem.item_id}`, payload);
    setEditItem(null);
    setIsEditModalOpen(false);
    fetchItems();
  };

  const deleteItem = async (item_id) => {
    await axios.delete(`${API}/items/${item_id}`);
    fetchItems();
  };

  const exportCSV = async () => {
    const res = await axios.get(`${API}/items/export.csv`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'ItemMaster.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const exportXLSX = async () => {
    try {
      const res = await axios.get(`${API}/items/export.xlsx`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'ItemMaster.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('XLSX export failed, falling back to CSV:', err);
      alert('XLSX export is not available on the server. Downloading CSV instead.');
      await exportCSV();
    }
  };

  const submitImport = async () => {
    if (!importFile) {
      setImportError('Please select a CSV or XLSX file.');
      return;
    }
    try {
      setIsImporting(true);
      const formData = new FormData();
      formData.append('file', importFile);
      await axios.post(`${API}/items/import?mode=${importMode}`, formData);
      await fetchItems();
      setIsImportModalOpen(false);
      setImportFile(null);
      setImportError("");
    } catch (err) {
      console.error('Import failed:', err);
      const msg = err?.response?.data?.detail || 'Import failed. Please check the file format and try again.';
      setImportError(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplateCSV = async () => {
    try {
      await exportCSV();
    } catch (e) {
      console.error('Template download failed:', e);
    }
  };

  const handleImportClick = async () => {
    if (!importFile) {
      setImportError('Select a CSV or XLSX file to enable Import.');
      // Open the file picker for convenience
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
      return;
    }
    await submitImport();
  };

  const filteredItems = items.filter(item => {
    const rate = parseFloat(search.rate);
    let rateMatch = true;
    if (!isNaN(rate)) {
      switch (search.rateOperator) {
        case '==': rateMatch = item.rate === rate; break;
        case '!=': rateMatch = item.rate !== rate; break;
        case '>': rateMatch = item.rate > rate; break;
        case '<': rateMatch = item.rate < rate; break;
        default: break;
      }
    }
    return (
      (!search.division || item.division?.name.toLowerCase().includes(search.division.toLowerCase())) &&
      (!search.code || item.item_code.toLowerCase().includes(search.code.toLowerCase())) &&
      (!search.description || item.item_description.toLowerCase().includes(search.description.toLowerCase())) &&
      (!search.unit || item.unit === search.unit) &&
      (search.rate === '' || rateMatch) &&
      (!search.region || item.region === search.region)
    );
  });

  const getColumnValue = (item, column) => {
    switch (column) {
      case 'division':
        return item.division?.name ?? '';
      case 'code':
        return item.item_code ?? '';
      case 'description':
        return item.item_description ?? '';
      case 'unit':
        return item.unit ?? '';
      case 'rate':
        return item.rate;
      case 'region':
        return item.region ?? '';
      default:
        return '';
    }
  };

  const isStringColumn = (col) => ['division', 'code', 'description', 'unit', 'region'].includes(col);
  const isNumberColumn = (col) => ['rate'].includes(col);

  const massFilterMatches = (item) => {
    const col = massFilterColumn;
    const op = massFilterOperator;
    const val = massFilterValue;
    if (!val && val !== 0) return false;
    const v = getColumnValue(item, col);
    if (isStringColumn(col)) {
      const lhs = String(v || '').toLowerCase();
      const rhs = String(val).toLowerCase();
      switch (op) {
        case 'equals': return lhs === rhs;
        case 'not_equals': return lhs !== rhs;
        case 'contains': return lhs.includes(rhs);
        case 'starts_with': return lhs.startsWith(rhs);
        case 'ends_with': return lhs.endsWith(rhs);
        default: return false;
      }
    } else if (isNumberColumn(col)) {
      const num = parseFloat(val);
      if (Number.isNaN(num)) return false;
      switch (op) {
        case 'equals': return v === num;
        case 'not_equals': return v !== num;
        case 'less_than': return v < num;
        case 'less_or_equal': return v <= num;
        case 'greater_than': return v > num;
        case 'greater_or_equal': return v >= num;
        default: return false;
      }
    }
    return false;
  };

  const massFilteredItems = items.filter(massFilterMatches);
  const isMassFilterActive = massFilterValue !== '';
  const deleteCandidates = isMassFilterActive ? massFilteredItems : filteredItems;

  const bulkDeleteFiltered = async () => {
    const ids = deleteCandidates.map(it => it.item_id).filter(Boolean);
    if (ids.length === 0) {
      setToast("No items to delete");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    try {
      setIsMassDeleting(true);
      const results = await Promise.allSettled(ids.map(id => axios.delete(`${API}/items/${id}`)));
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      await fetchItems();
      setIsMassDeleteModalOpen(false);
      setIsMassDeleteConfirmOpen(false);
      setToast(`Deleted ${succeeded} item(s). Failed ${failed}.`);
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error('Mass delete failed:', err);
      const msg = err?.response?.data?.detail || 'Mass delete encountered an error.';
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsMassDeleting(false);
    }
  };

  // Mass delete with visible progress bar (n of N)
  const bulkDeleteFilteredWithProgress = async () => {
    const ids = deleteCandidates.map(it => it.item_id).filter(Boolean);
    if (ids.length === 0) {
      setToast("No items to delete");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    try {
      setIsMassDeleting(true);
      setIsMassDeleteConfirmOpen(true);
      // initialize progress
      setMassDeleteTotal(ids.length);
      setMassDeleteCompleted(0);
      setMassDeleteFailed(0);
      let completed = 0;
      let failed = 0;
      const batchSize = 20; // delete in batches for visible progress
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(id => axios.delete(`${API}/items/${id}`)));
        const succeededInBatch = results.filter(r => r.status === 'fulfilled').length;
        const failedInBatch = results.length - succeededInBatch;
        completed += succeededInBatch;
        failed += failedInBatch;
        setMassDeleteCompleted(prev => prev + succeededInBatch);
        setMassDeleteFailed(prev => prev + failedInBatch);
      }
      await fetchItems();
      setIsMassDeleteModalOpen(false);
      setIsMassDeleteConfirmOpen(false);
      if (failed === 0) {
        setToast(`Successfully deleted ${completed} item(s).`);
      } else {
        setToast(`Successfully deleted ${completed} item(s). Failed ${failed}.`);
      }
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error('Mass delete failed:', err);
      const msg = err?.response?.data?.detail || 'Mass delete encountered an error.';
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsMassDeleting(false);
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const showingStart = filteredItems.length ? indexOfFirstItem + 1 : 0;
  const showingEnd = Math.min(indexOfLastItem, filteredItems.length);

  // Make table fill viewport and scroll internally
  const tableScrollRef = useRef(null);
  const bottomPaginationRef = useRef(null);
  const [tableScrollHeight, setTableScrollHeight] = useState(null);
  // Row selection state
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [isItemDetailOpen, setIsItemDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [isDeleteSelectedConfirmOpen, setIsDeleteSelectedConfirmOpen] = useState(false);
  // Mass delete progress state
  const [massDeleteTotal, setMassDeleteTotal] = useState(0);
  const [massDeleteCompleted, setMassDeleteCompleted] = useState(0);
  const [massDeleteFailed, setMassDeleteFailed] = useState(0);

  const toggleSelectItem = (id) => {
    setSelectedItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const clearSelection = () => setSelectedItemIds([]);
  const currentPageItemIds = () => currentItems.map(it => it.item_id).filter(Boolean);
  const toggleSelectAllCurrent = () => {
    const ids = currentPageItemIds();
    const allSelected = ids.every(id => selectedItemIds.includes(id));
    setSelectedItemIds(prev => allSelected ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids])));
  };
  const openItemDetail = (id) => {
    const it = items.find(x => x.item_id === id);
    if (!it) return;
    setDetailItem(it);
    setIsItemDetailOpen(true);
  };
  const deleteSelectedItems = async () => {
    const ids = selectedItemIds.filter(Boolean);
    if (ids.length === 0) return;
    try {
      const results = await Promise.allSettled(ids.map(id => axios.delete(`${API}/items/${id}`)));
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      await fetchItems();
      setToast(`Deleted ${succeeded} item(s). Failed ${failed}.`);
      setTimeout(() => setToast(null), 3000);
      clearSelection();
      setIsDeleteSelectedConfirmOpen(false);
    } catch (err) {
      console.error('Delete selected failed:', err);
      const msg = err?.response?.data?.detail || 'Delete selected encountered an error.';
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Keyboard: Item Detail ESC closes; Edit modal ESC closes, Enter saves; Delete-selected confirm ESC cancels, Enter confirms
  useEffect(() => {
    const onKey = (e) => {
      if (isItemDetailOpen && e.key === 'Escape') {
        e.preventDefault();
        setIsItemDetailOpen(false);
      }
      if (isEditModalOpen) {
        if (e.key === 'Escape') { e.preventDefault(); setIsEditModalOpen(false); }
        if (e.key === 'Enter') { e.preventDefault(); updateItem(); }
      }
      if (isDeleteSelectedConfirmOpen) {
        if (e.key === 'Escape') { e.preventDefault(); setIsDeleteSelectedConfirmOpen(false); }
        if (e.key === 'Enter') { e.preventDefault(); deleteSelectedItems(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isItemDetailOpen, isEditModalOpen, isDeleteSelectedConfirmOpen, updateItem]);

  useEffect(() => {
    const computeHeight = () => {
      const sc = tableScrollRef.current;
      if (!sc) return;
      const rect = sc.getBoundingClientRect();
      const bottomH = bottomPaginationRef.current ? bottomPaginationRef.current.getBoundingClientRect().height : 0;
      const padding = 16; // small breathing space
      const available = window.innerHeight - rect.top - bottomH - padding;
      setTableScrollHeight(Math.max(240, available));
    };
    computeHeight();
    window.addEventListener('resize', computeHeight);
    return () => window.removeEventListener('resize', computeHeight);
  }, []);



  return (
    <div className="item-master-font relative bg-white p-4 sm:p-6 -mx-6 -mb-6 w-[calc(100%+3rem)]">
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-white text-emerald-700 border border-emerald-300 shadow px-4 py-2 rounded text-sm font-medium">
          {toast}
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Item Master</h2>
        <div className="flex gap-2">
          <button onClick={() => setIsAddDivisionModalOpen(true)} className="bg-teal-700 hover:bg-teal-900 text-white text-xs font-extralight py-1 px-4 rounded inline-flex items-center gap-1">
            <FaPlus className="w-3 h-3" />
            <span>Add Division</span>
          </button>
          <button onClick={() => setIsAddItemModalOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-extralight py-1 px-4 rounded inline-flex items-center gap-1">
            <FaPlus className="w-3 h-3" />
            <span>Add Item</span>
          </button>
          <div className="relative inline-block" ref={exportMenuContainerRef}>
            <div className="flex shadow-sm">
              <button
                onClick={() => { setIsExportMenuOpen(!isExportMenuOpen); setExportFocusedIndex(0); }}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-medium py-1 px-4 rounded-l"
              >
                Export
              </button>
              <button
                onClick={() => { setIsExportMenuOpen(!isExportMenuOpen); setExportFocusedIndex(0); }}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium py-1 px-2 rounded-r"
              >
                <FaChevronDown />
              </button>
            </div>
            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white border border-teal-200 rounded-md shadow-lg z-20" ref={exportMenuRef}>
                <button
                  onClick={() => { setIsExportMenuOpen(false); exportCSV(); }}
                  className={`block w-full text-left px-4 py-2 text-sm text-teal-800 ${exportFocusedIndex === 0 ? 'bg-teal-50' : ''}`}
                >
                  Export CSV
                </button>
                <button
                  onClick={() => { setIsExportMenuOpen(false); exportXLSX(); }}
                  className={`block w-full text-left px-4 py-2 text-sm text-teal-800 ${exportFocusedIndex === 1 ? 'bg-teal-50' : ''}`}
                >
                  Export XLSX
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-xs font-medium py-1 px-4 rounded shadow-sm"
          >
            Import Item
          </button>
          <button
            onClick={() => setIsMassDeleteModalOpen(true)}
            className="bg-white border border-blue-600 text-blue-700 hover:bg-blue-50 text-xs font-medium py-1 px-4 rounded shadow-sm"
          >
            Mass Delete
          </button>
        </div>
      </div>

      {isAddDivisionModalOpen && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-xl z-50 relative border border-gray-200">
            <button onClick={() => setIsAddDivisionModalOpen(false)} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900">Add New Division</h2>
            <p className="text-sm text-gray-600 mb-4">Create a division to group related items.</p>
            <div className="mt-2">
              <input
                className={`border ${addDivisionError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'} p-3 rounded-lg w-full focus:outline-none focus:ring-2`}
                value={divisionName}
                onChange={(e) => {
                  setDivisionName(e.target.value);
                  if (addDivisionError && e.target.value.trim()) setAddDivisionError("");
                }}
                placeholder="Division name"
              />
              {addDivisionError && (
                <p className="mt-2 text-sm text-red-600">{addDivisionError}</p>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsAddDivisionModalOpen(false)}
                className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs"
              >
                Cancel
              </button>
              <button
                onClick={addDivision}
                className="bg-teal-700 hover:bg-teal-900 text-white font-medium py-1 px-3 rounded inline-flex items-center gap-1 text-xs"
              >
                <FaPlus className="w-3 h-3" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddItemModalOpen && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-2xl z-50 relative border border-gray-200">
            <button onClick={() => setIsAddItemModalOpen(false)} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Add New Item</h2>
            <p className="text-xs text-gray-600 mb-3">Fill in item details including division, unit, and region.</p>
            {addItemError && (
              <p className="mb-3 text-sm text-red-600">{addItemError}</p>
            )}
            <form onSubmit={(e) => addItem(e)} className="grid grid-cols-1 gap-3 mt-2">
              
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDivisionDropdownOpen(v => !v)}
                  className="border border-gray-300 p-2 rounded w-full text-left text-xs flex justify-between items-center"
                >
                  <span>{divisions.find(d => String(d.division_id) === String(form.division_id))?.name || "Select Division"}</span>
                  <svg className="w-3 h-3 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/></svg>
                </button>
                {isDivisionDropdownOpen && (
                  <div className="absolute mt-1 w-full bg-white border border-gray-200 rounded shadow z-50 max-h-48 overflow-auto">
                    {divisions.length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-500">No divisions</div>
                    )}
                    {divisions.map(d => (
                      <div key={d.division_id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <button type="button" className="text-left flex-1 text-xs" onClick={() => { setForm({ ...form, division_id: d.division_id }); setIsDivisionDropdownOpen(false); }}>
                          {d.name}
                        </button>
                        <button type="button" className="text-red-600 hover:text-red-800 ml-2" onClick={() => requestDeleteDivision(d.division_id)}>
                          <FaTrash className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input
                name="item_code"
                value={form.item_code}
                onChange={handleChange}
                placeholder="Item Code"
                className={`border ${addItemError && !form.item_code.trim() ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'} p-3 rounded-lg w-full focus:outline-none focus:ring-2 text-xs`}
              />
              <select
                name="unit"
                value={form.unit}
                onChange={(e) => {
                  if (e.target.value === "add_new_unit") {
                    setIsAddingNewUnit(true);
                  } else {
                    setForm({ ...form, unit: e.target.value });
                    setIsAddingNewUnit(false);
                  }
                }}
                className={`border ${addItemError && !form.unit ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'} p-3 rounded-lg w-full focus:outline-none focus:ring-2 text-xs`}
              >
                <option value="">Select Unit</option>
                {uniqueUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                <option value="add_new_unit">Add New Unit</option>
              </select>
              {isAddingNewUnit && (
                <div className="flex items-center">
                  <input
                    type="text"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    placeholder="New Unit"
                    className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newUnit && !uniqueUnits.includes(newUnit)) {
                        setUniqueUnits([...uniqueUnits, newUnit]);
                        setForm({ ...form, unit: newUnit });
                        setNewUnit("");
                        setIsAddingNewUnit(false);
                      }
                    }}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-3 rounded ml-2 transition-colors text-xs"
                  >
                    Add
                  </button>
                </div>
              )}
              <input
                name="item_description"
                value={form.item_description}
                onChange={handleChange}
                placeholder="Item Description"
                className={`border ${addItemError && !form.item_description.trim() ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'} p-3 rounded-lg w-full focus:outline-none focus:ring-2 text-xs`}
              />
              <input
                name="rate"
                value={form.rate}
                onChange={handleChange}
                placeholder="Rate"
                className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
              />
              <select
                name="region"
                value={form.region}
                onChange={handleChange}
                className={`border ${addItemError && !form.region ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'} p-3 rounded-lg w-full focus:outline-none focus:ring-2 text-xs`}
              >
                <option value="">Select Region…</option>
                {REGION_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-teal-700 hover:bg-teal-900 text-white font-medium py-1 px-3 rounded inline-flex items-center gap-1 text-xs"
                >
                  <FaPlus className="w-3 h-3" />
                  <span>Add Item</span>
                </button>
              </div>
            </form>
            {isConfirmDeleteDivisionOpen && (
              <div className="fixed inset-0 bg-black/20 flex justify-center items-center z-[60]">
                <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Delete Division</h3>
                  <p className="text-xs text-gray-600 mb-4">Do you want to delete this division? This will remove related items.</p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setIsConfirmDeleteDivisionOpen(false); setConfirmDeleteDivisionId(null); }}
                      className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={deleteDivisionById}
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-xl z-50 relative border border-gray-200">
            <button onClick={() => setIsImportModalOpen(false)} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-xl sm:text-2xl font-semibold mb-2 text-gray-900">Import Item Master</h2>
            <p className="text-sm text-gray-600 mb-4">Upload a CSV or XLSX in the Item Master format. Choose whether to replace all items or add on top.</p>
            <div className="space-y-4">
              <div className="space-y-3">
                <input
                  type="file"
                  accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={(e) => { setImportFile(e.target.files[0] || null); setImportError(""); setIsImportDragging(false); }}
                  ref={fileInputRef}
                  id="importFileInput"
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
                <button type="button" onClick={downloadTemplateCSV} className="text-xs text-teal-700 hover:text-teal-900 underline">Download CSV template</button>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input type="radio" name="importMode" value="append" checked={importMode === 'append'} onChange={(e) => setImportMode(e.target.value)} />
                  <span>Add on top (upsert)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="importMode" value="replace" checked={importMode === 'replace'} onChange={(e) => setImportMode(e.target.value)} />
                  <span>Replace entire Item master</span>
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
            </div>
          </div>
        </div>
      )}

      {isMassDeleteModalOpen && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div ref={massDeleteContainerRef} className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-xl z-50 relative border border-gray-200">
            <button onClick={() => setIsMassDeleteModalOpen(false)} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-xl sm:text-2xl font-semibold mb-2 text-gray-900">Mass Delete Items</h2>
            <p className="text-sm text-gray-700 mb-3">Use the filter below to target items. This action cannot be undone.</p>
            <div className="grid grid-cols-3 gap-2 mb-4 items-end">
              <div>
                <label className="text-xs text-gray-700">Column</label>
                <select value={massFilterColumn} onChange={(e)=>{ setMassFilterColumn(e.target.value); setMassFilterOperator('equals'); setMassFilterValue(''); }} className="w-full border p-2 rounded text-xs">
                  <option value="division">Division</option>
                  <option value="code">Code</option>
                  <option value="description">Description</option>
                  <option value="unit">Unit</option>
                  <option value="rate">Rate</option>
                  <option value="region">Region</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-700">Operator</label>
                <select value={massFilterOperator} onChange={(e)=>setMassFilterOperator(e.target.value)} className="w-full border p-2 rounded text-xs">
                  {isStringColumn(massFilterColumn) && (
                    <>
                      <option value="equals">Equals</option>
                      <option value="not_equals">Not Equals</option>
                      <option value="contains">Contains</option>
                      <option value="starts_with">Starts With</option>
                      <option value="ends_with">Ends With</option>
                    </>
                  )}
                  {isNumberColumn(massFilterColumn) && (
                    <>
                      <option value="equals">Equals</option>
                      <option value="not_equals">Not Equals</option>
                      <option value="less_than">Less Than</option>
                      <option value="less_or_equal">Less Than or Equal</option>
                      <option value="greater_than">Greater Than</option>
                      <option value="greater_or_equal">Greater Than or Equal</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-700">Value</label>
                <input type={isNumberColumn(massFilterColumn) ? 'number' : 'text'} value={massFilterValue} onChange={(e)=>setMassFilterValue(e.target.value)} className="w-full border p-2 rounded text-xs" placeholder={isNumberColumn(massFilterColumn) ? 'Enter number' : 'Enter text'} />
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-2">Matching items: <span className="font-medium">{isMassFilterActive ? massFilteredItems.length : filteredItems.length}</span></p>
            {deleteCandidates.length > 0 && (
              <div className="mb-4 border rounded-md bg-gray-50">
                <div className="px-3 py-2 text-xs text-gray-600">Sample of items to be deleted:</div>
                <ul className="max-h-36 overflow-auto text-xs text-gray-800">
                  {deleteCandidates.slice(0, 10).map(it => (
                    <li key={it.item_id} className="px-3 py-1 border-t border-gray-100">
                      <span className="font-medium">{it.item_code}</span> — {it.item_description}
                    </li>
                  ))}
                </ul>
                {deleteCandidates.length > 10 && (
                  <div className="px-3 py-2 text-[11px] text-gray-500">…and {deleteCandidates.length - 10} more</div>
                )}
              </div>
            )}
            {isMassDeleteConfirmOpen && (
              <div className="mb-4 border border-red-200 bg-red-50 rounded-md px-3 py-2">
                <p className="text-xs text-red-700 mb-2">This will delete <span className="font-semibold">{deleteCandidates.length}</span> item(s) permanently. Continue?</p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMassDeleteConfirmOpen(false)}
                    disabled={isMassDeleting}
                    className={`${isMassDeleting ? 'opacity-70 cursor-not-allowed' : ''} bg-white border border-blue-600 text-blue-700 hover:bg-blue-50 font-semibold text-xs py-1 px-3 rounded-md`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={bulkDeleteFilteredWithProgress}
                    disabled={isMassDeleting}
                    className={`${isMassDeleting ? 'opacity-70 cursor-not-allowed' : ''} bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-1 px-3 rounded-md`}
                  >
                    Confirm
                  </button>
                </div>
                {isMassDeleting && (
                  <div className="mt-2">
                    <p className="text-xs text-red-700 mb-2">Deleting… <span className="font-semibold">{massDeleteCompleted}</span> of <span className="font-semibold">{massDeleteTotal}</span> item(s)</p>
                    <div className="w-full h-2 bg-red-100 rounded">
                      <div className="h-2 bg-red-500 rounded" style={{ width: `${massDeleteTotal ? Math.round((massDeleteCompleted / massDeleteTotal) * 100) : 0}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsMassDeleteModalOpen(false)}
                disabled={isMassDeleting}
                className={`${isMassDeleting ? 'opacity-70 cursor-not-allowed' : ''} bg-white border border-blue-600 text-blue-700 hover:bg-blue-50 font-semibold text-sm py-1 px-4 rounded-md`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteCandidates.length > 0) setIsMassDeleteConfirmOpen(true);
                }}
                disabled={isMassDeleting || deleteCandidates.length === 0}
                className={`${isMassDeleting ? 'opacity-70 cursor-not-allowed' : ''} bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-1 px-4 rounded-md`}
              >
                {isMassDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-500">Note: Items referenced elsewhere may fail to delete. Successful deletions will proceed.</p>
          </div>
        </div>
      )}

      

      <div className="border rounded-lg flex flex-col border-gray-200">
        <div className="overflow-x-auto w-full">
          <div ref={tableScrollRef} style={{ height: tableScrollHeight ? `${tableScrollHeight}px` : undefined }} className="overflow-auto">
            <table className="min-w-full border-collapse table-fixed">
              <thead className="sticky top-0 z-10 bg-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[40px] text-gray-800 border-gray-200">
                    <input type="checkbox" onChange={toggleSelectAllCurrent} checked={currentPageItemIds().length > 0 && currentPageItemIds().every(id => selectedItemIds.includes(id))} />
                  </th>
                  <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Division</th>
                  <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Code</th>
                  <th className="px-2 py-1 text-left text-xs font-bold border-r w-[30%] text-gray-800 border-gray-200">Description</th>
                  <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Unit</th>
                  <th className="px-2 py-1 text-right text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Rate</th>
                  <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Region</th>
                </tr>
                <tr>
                  <th className="px-2 py-1 border-r min-w-[40px] border-gray-200"></th>
                  <th className="px-2 py-1 border-r min-w-[120px] sm:min-w-[150px] border-gray-200">
                    <input type="text" placeholder="Search..." value={search.division} onChange={(e) => setSearch({ ...search, division: e.target.value })} className="w-full text-xs px-2 py-1 border rounded-md transition-colors bg-white text-gray-900 border-gray-300 placeholder-gray-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-200" />
                  </th>
                  <th className="px-2 py-1 border-r min-w-[120px] sm:min-w-[150px] border-gray-200">
                    <input type="text" placeholder="Search..." value={search.code} onChange={(e) => setSearch({ ...search, code: e.target.value })} className="w-full text-xs px-2 py-1 border rounded-md transition-colors bg-white text-gray-900 border-gray-300 placeholder-gray-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-200" />
                  </th>
                  <th className="px-2 py-1 border-r min-w-[120px] sm:min-w-[150px] border-gray-200">
                    <input type="text" placeholder="Search..." value={search.description} onChange={(e) => setSearch({ ...search, description: e.target.value })} className="w-full text-xs px-2 py-1 border rounded-md transition-colors bg-white text-gray-900 border-gray-300 placeholder-gray-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-200" />
                  </th>
                  <th className="px-2 py-1 border-r min-w-[120px] sm:min-w-[150px] border-gray-200">
                    <select value={search.unit} onChange={(e) => setSearch({ ...search, unit: e.target.value })} className="w-full text-xs px-2 py-1 border rounded-md transition-colors bg-white text-gray-900 border-gray-300 placeholder-gray-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-200">
                      <option value="">All Units</option>
                      {uniqueUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                  </th>
                  <th className="px-2 py-1 border-r min-w-[120px] sm:min-w-[150px] border-gray-200">
                    <div className="flex items-center">
                      <select value={search.rateOperator} onChange={(e) => setSearch({ ...search, rateOperator: e.target.value })} className="mr-1 w-auto text-xs px-2 py-1 border rounded-md transition-colors bg-white text-gray-900 border-gray-300 placeholder-gray-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-200">
                        <option value="==">==</option>
                        <option value="!=">!=</option>
                        <option value=">"> &gt;</option>
                        <option value="<">&lt;</option>
                      </select>
                      <input type="text" placeholder="Search..." value={search.rate} onChange={(e) => setSearch({ ...search, rate: e.target.value })} className="w-full text-xs px-2 py-1 border rounded-md transition-colors bg-white text-gray-900 border-gray-300 placeholder-gray-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-200" />
                    </div>
                  </th>
                  <th className="px-2 py-1 border-r min-w-[120px] sm:min-w-[150px] border-gray-200">
                    <select value={search.region} onChange={(e) => setSearch({ ...search, region: e.target.value })} className="w-full text-xs px-2 py-1 border rounded-md transition-colors bg-white text-gray-900 border-gray-300 placeholder-gray-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-200">
                      <option value="">All Regions</option>
                      {uniqueRegions.map(region => <option key={region} value={region}>{region}</option>)}
                    </select>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-4 sm:p-8 text-center text-gray-600">
                      <div className="flex flex-col items-center">
                        <div className="text-lg mb-2">📭</div>
                        <div className="text-sm font-medium">No data found</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentItems
                    .map((it, i) => (
                      <tr key={it.item_id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-teal-50 transition-colors ${selectedItemIds.includes(it.item_id) ? 'bg-indigo-100' : ''}`}>
                        <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">
                          <input type="checkbox" checked={selectedItemIds.includes(it.item_id)} onChange={() => toggleSelectItem(it.item_id)} />
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{it.division?.name ?? "—"}</td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{it.item_code}</td>
                        <td className="px-2 py-1 whitespace-normal break-words text-xs border-r text-gray-800 border-gray-200 max-w-[28rem]" title={it.item_description}>{it.item_description}</td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{it.unit}</td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200 text-right">{formatRate(it.rate)}</td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{it.region}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
            {selectedItemIds.length > 0 && (
              <div className="sticky bottom-0 z-20 bg-gray-800 text-white px-3 py-2 border-t border-gray-700 flex items-center justify-between">
                <div className="text-xs">{selectedItemIds.length} selected item(s)</div>
                {selectedItemIds.length === 1 ? (
                  <div className="flex items-center gap-2">
                    <button className="bg-gray-200 text-gray-900 text-xs px-3 py-1 rounded" onClick={() => openItemDetail(selectedItemIds[0])}>Item Detail</button>
                    <button className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-3 py-1 rounded" onClick={() => {
                      const it = items.find(x => x.item_id === selectedItemIds[0]);
                      if (it) handleEdit(it);
                    }}>Edit</button>
                    <button className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded" onClick={() => requestDeleteItem(selectedItemIds[0])}>Delete</button>
                    <button className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-3 py-1 rounded" onClick={clearSelection}>Clear selection</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {isDeleteSelectedConfirmOpen ? (
                      <>
                        <span className="text-xs">Delete {selectedItemIds.length} selected item(s)?</span>
                        <button className="bg-white text-red-700 border border-red-600 hover:bg-red-50 text-xs px-3 py-1 rounded" onClick={() => setIsDeleteSelectedConfirmOpen(false)}>Cancel</button>
                        <button className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded" onClick={deleteSelectedItems}>Confirm</button>
                      </>
                    ) : (
                      <button className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded" onClick={() => setIsDeleteSelectedConfirmOpen(true)}>Delete</button>
                    )}
                    <button className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-3 py-1 rounded" onClick={clearSelection}>Clear selection</button>
                  </div>
                )}
              </div>
            )}
            {selectedItemIds.length === 0 && isSearchActive() && (
              <div className="sticky bottom-0 z-20 bg-gray-800 text-white px-3 py-2 border-t border-gray-700 flex items-center justify-between">
                <div className="text-xs">Filters applied</div>
                <div className="flex items-center gap-2">
                  <button className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-3 py-1 rounded" onClick={clearAllSearch}>Clear all</button>
                </div>
              </div>
            )}
            {/* Bottom spacer to create a little space with header-like gray */}
            <div className="sticky bottom-0 h-4 bg-gray-100 border-t border-gray-200" />
          </div>
        </div>
      </div>
      <div ref={bottomPaginationRef} className="flex flex-wrap justify-between items-center p-4 gap-3">
        <div className="text-xs text-gray-600">
          {new Intl.NumberFormat('en-US').format(filteredItems.length)} rows
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <select
            value={itemsPerPage}
            onChange={(e)=>{ setItemsPerPage(parseInt(e.target.value,10) || 50); setCurrentPage(1); }}
            className="text-xs border rounded px-2 py-1 text-gray-700"
          >
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={200}>200 / page</option>
            <option value={300}>300 / page</option>
          </select>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 border rounded text-xs disabled:opacity-50 hover:bg-gray-100 text-gray-600"
              aria-label="Previous page"
            >
              ‹
            </button>
            {(() => {
              const maxButtons = 5;
              const pages = [];
              if (totalPages <= maxButtons) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else if (currentPage <= 3) {
                for (let i = 1; i <= maxButtons; i++) pages.push(i);
              } else if (currentPage >= totalPages - 2) {
                for (let i = totalPages - maxButtons + 1; i <= totalPages; i++) pages.push(i);
              } else {
                for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
              }
              return (
                <>
                  {pages.map(p => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`px-2 py-1 border rounded text-xs ${p === currentPage ? 'bg-indigo-600 text-white border-indigo-600' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                      {p}
                    </button>
                  ))}
                  {totalPages > pages[pages.length-1] && (
                    <>
                      <span className="px-2 py-1 text-gray-400 text-xs">…</span>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        className="px-2 py-1 border rounded text-xs hover:bg-gray-100 text-gray-600"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </>
              );
            })()}
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages || 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2 py-1 border rounded text-xs disabled:opacity-50 hover:bg-gray-100 text-gray-600"
              aria-label="Next page"
            >
              ›
            </button>
          </div>
          <div className="flex items-center gap-2 ml-3 text-xs text-gray-600">
            <span>Go to</span>
            <input
              type="number"
              min={1}
              max={Math.max(totalPages,1)}
              onKeyDown={(e)=>{ if(e.key==='Enter'){ const val = parseInt(e.currentTarget.value,10); if(!Number.isNaN(val)){ setCurrentPage(Math.min(Math.max(val,1), totalPages || 1)); e.currentTarget.blur(); } } }}
              className="w-16 border rounded px-2 py-1 text-xs text-gray-700"
              placeholder=""
            />
          </div>
        </div>
      </div>

      {isItemDetailOpen && detailItem && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={(e)=>{ if(e.target===e.currentTarget) setIsItemDetailOpen(false); }}>
          <div className="relative bg-white rounded-lg shadow-xl w-[95%] max-w-3xl p-6">
            <button onClick={() => setIsItemDetailOpen(false)} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">✕</button>
            <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900">Item Detail</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="font-semibold text-gray-700">Division:</span> <span className="text-gray-900">{detailItem.division?.name ?? '—'}</span></div>
              <div><span className="font-semibold text-gray-700">Code:</span> <span className="text-gray-900">{detailItem.item_code}</span></div>
              <div className="sm:col-span-2"><span className="font-semibold text-gray-700">Description:</span> <span className="text-gray-900" title={detailItem.item_description}>{detailItem.item_description}</span></div>
              <div><span className="font-semibold text-gray-700">Unit:</span> <span className="text-gray-900">{detailItem.unit}</span></div>
              <div><span className="font-semibold text-gray-700">Rate:</span> <span className="text-gray-900">{formatRate(detailItem.rate)}</span></div>
              <div><span className="font-semibold text-gray-700">Region:</span> <span className="text-gray-900">{detailItem.region}</span></div>
              <div><span className="font-semibold text-gray-700">Item ID:</span> <span className="text-gray-900">{detailItem.item_id}</span></div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setIsItemDetailOpen(false)} className="bg-gray-300 text-black px-3 py-1 rounded">Close</button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && editItem && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-2xl z-50 relative border border-gray-200">
            <button onClick={() => setIsEditModalOpen(false)} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-xl sm:text-2xl font-semibold mb-2 text-gray-900">Edit Item</h2>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <select name="division_id" value={editItem.division_id} onChange={(e) => setEditItem({ ...editItem, division_id: e.target.value })} className="border border-gray-300 p-3 rounded-lg col-span-1 focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">Division</option>
                {divisions.map(d => <option key={d.division_id} value={d.division_id}>{d.name}</option>)}
              </select>
              <input name="item_code" value={editItem.item_code} onChange={(e) => setEditItem({ ...editItem, item_code: e.target.value })} placeholder="Code" className="border border-gray-300 p-3 rounded-lg col-span-1 focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <input name="item_description" value={editItem.item_description} onChange={(e) => setEditItem({ ...editItem, item_description: e.target.value })} placeholder="Description" className="border border-gray-300 p-3 rounded-lg col-span-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <select name="unit" value={editItem.unit} onChange={(e) => {
                if (e.target.value === "add_new_unit") {
                  setIsAddingNewUnit(true);
                } else {
                  setEditItem({ ...editItem, unit: e.target.value });
                  setIsAddingNewUnit(false);
                }
              }} className="border border-gray-300 p-3 rounded-lg col-span-1 focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">Select Unit</option>
                {uniqueUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                <option value="add_new_unit">Add New Unit</option>
              </select>
              {isAddingNewUnit && (
                <div className="col-span-2 flex items-center">
                  <input
                    type="text"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    placeholder="New Unit"
                    className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newUnit && !uniqueUnits.includes(newUnit)) {
                        setUniqueUnits([...uniqueUnits, newUnit]);
                        setEditItem({ ...editItem, unit: newUnit });
                        setNewUnit("");
                        setIsAddingNewUnit(false);
                      }
                    }}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg ml-2 transition-colors"
                  >
                    Add
                  </button>
                </div>
              )}
              <input name="rate" value={editItem.rate} onChange={(e) => setEditItem({ ...editItem, rate: e.target.value })} placeholder="Rate" className="border border-gray-300 p-3 rounded-lg col-span-1 focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <input name="region" value={editItem.region} onChange={(e) => setEditItem({ ...editItem, region: e.target.value })} placeholder="Region" className="border border-gray-300 p-3 rounded-lg col-span-1 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={updateItem} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}

      {isConfirmDeleteItemOpen && (
        <div className="fixed inset-0 bg-black/20 flex justify-center items-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w/full max-w-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Delete Item</h3>
            <p className="text-xs text-gray-600 mb-4">Do you want to delete this item? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                disabled={isDeletingItem}
                onClick={() => { setIsConfirmDeleteItemOpen(false); setConfirmDeleteItemId(null); }}
                className={`bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs ${isDeletingItem ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                Cancel
              </button>
              <button
                disabled={isDeletingItem}
                onClick={deleteItemById}
                className={`bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded text-xs ${isDeletingItem ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {isDeletingItem ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
