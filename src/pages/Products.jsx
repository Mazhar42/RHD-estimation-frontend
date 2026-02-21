import React, { useEffect, useState, useRef } from "react";
import { apiClient } from "../api/axios";
import { listOrganizations, listRegions, createRegion, deleteRegion, createOrganization, deleteOrganization, updateOrganization, updateRegion } from "../api/orgs";
import { importItems } from "../api/items";
import { FaEdit, FaTrash, FaPlus, FaUpload } from "react-icons/fa";
import { useAuth } from "../hooks/useAuth";

// Use robust API base to avoid '/undefined' in production

export default function Products() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin") || hasRole("superadmin");
  const [isAddDivisionModalOpen, setIsAddDivisionModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [divisions, setDivisions] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null); // {org_id, name}
  const [orgRegionObjs, setOrgRegionObjs] = useState([]); // [{region_id,name,organization_id}]
  const orgRegions = React.useMemo(() => orgRegionObjs.map(r => r.name), [orgRegionObjs]);
  const [isManageRegionsOpen, setIsManageRegionsOpen] = useState(false);
  const [newRegionName, setNewRegionName] = useState("");
  const [addRegionError, setAddRegionError] = useState("");
  const [editingRegionId, setEditingRegionId] = useState(null);
  const [editingRegionName, setEditingRegionName] = useState("");
  const [confirmDeleteRegionId, setConfirmDeleteRegionId] = useState(null);
  const [isManageOrganizationsOpen, setIsManageOrganizationsOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [addOrgError, setAddOrgError] = useState("");
  const [editingOrgId, setEditingOrgId] = useState(null);
  const [editingOrgName, setEditingOrgName] = useState("");
  const [confirmDeleteOrgId, setConfirmDeleteOrgId] = useState(null);
  const [items, setItems] = useState([]);
  const [specialItems, setSpecialItems] = useState([]);
  const [specialItemsLoading, setSpecialItemsLoading] = useState(false);
  const [specialItemsError, setSpecialItemsError] = useState("");
  const [activeTab, setActiveTab] = useState("items");
  const [divisionName, setDivisionName] = useState("");
  const makeInitialRegionRates = React.useCallback((regions) => Object.fromEntries((regions || []).map(r => [r, ""])), []);
  const [form, setForm] = useState({ item_code: "", item_description: "", unit: "", division_id: "", organization: "", regionRates: {} });
  const [editItem, setEditItem] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [search, setSearch] = useState({ division: "", code: "", description: "", unit: "", rate: "", rateOperator: "==", region: "", organization: "" });
  const [uniqueUnits, setUniqueUnits] = useState([]);
  const [isAddingNewUnit, setIsAddingNewUnit] = useState(false);
  const [newUnit, setNewUnit] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState("append");
  const [importFile, setImportFile] = useState(null);
  // Export option removed permanently
  // Safety: define removed export menu states to avoid stray references
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuContainerRef = useRef(null);
  const [isImportDragging, setIsImportDragging] = useState(false);
  const [isMassDeleteModalOpen, setIsMassDeleteModalOpen] = useState(false);
  const [isMassDeleting, setIsMassDeleting] = useState(false);
  const massDeleteContainerRef = useRef(null);
  // Multi-condition filters (AND) for mass delete
  const [massFilters, setMassFilters] = useState([
    { column: 'division', operator: 'equals', value: '' },
  ]);
  const [massFilterJoin, setMassFilterJoin] = useState('AND'); // 'AND' | 'OR'
  const [massFilterColumn, setMassFilterColumn] = useState("division");
  const [massFilterOperator, setMassFilterOperator] = useState("equals");
  const [massFilterValue, setMassFilterValue] = useState("");
  const [isMassDeleteConfirmOpen, setIsMassDeleteConfirmOpen] = useState(false);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importBanner, setImportBanner] = useState(null); // { type: 'success'|'warning'|'error'|'info', message: string }
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
      search.organization ||
      (search.rateOperator && search.rateOperator !== '==')
    );
  };

  // Clear all search filters to defaults
  const clearAllSearch = () => {
    setSearch({ division: "", code: "", description: "", unit: "", rate: "", rateOperator: "==", region: "", organization: "" });
    setCurrentPage(1);
  };

  // Format numeric rate values to two decimal places (e.g., 337.50)
  const formatRate = (val) => {
    const num = Number(val);
    return Number.isFinite(num) ? num.toFixed(2) : '';
  };

  useEffect(() => {
    fetchDivisions();
    // Load organizations and regions (default to RHD if available), then fetch items scoped to org
    (async () => {
      try {
        const orgs = await listOrganizations();
        setOrganizations(orgs);
        const defaultOrg = orgs.find(o => o.name === "RHD") || orgs[0] || null;
        setSelectedOrg(defaultOrg);
        if (defaultOrg) {
          const regs = await listRegions(defaultOrg.org_id);
          setOrgRegionObjs(regs);
          setForm(f => ({ ...f, organization: defaultOrg.name, regionRates: makeInitialRegionRates(regs.map(r => r.name)) }));
          await fetchItems(defaultOrg.name);
          await fetchSpecialItems(defaultOrg.name);
        } else {
          await fetchItems();
          await fetchSpecialItems();
        }
      } catch (e) {
        console.error("Failed to load organizations/regions", e);
      }
    })();
  }, []);

  const changeOrganization = async (orgId) => {
    const org = organizations.find(o => String(o.org_id) === String(orgId)) || null;
    setSelectedOrg(org);
    if (!org) {
      setOrgRegionObjs([]);
      setForm(f => ({ ...f, organization: "", regionRates: {} }));
      return;
    }
    try {
      const regs = await listRegions(org.org_id);
      setOrgRegionObjs(regs);
      setForm(f => ({ ...f, organization: org.name, regionRates: makeInitialRegionRates(regs.map(r => r.name)) }));
      await fetchItems(org.name);
      await fetchSpecialItems(org.name);
    } catch (e) {
      console.error("Failed to load regions", e);
    }
  };

  // Keep form regionRates in sync if orgRegions change while modal is open
  useEffect(() => {
    setForm(f => ({ ...f, regionRates: makeInitialRegionRates(orgRegions) }));
  }, [orgRegions, makeInitialRegionRates]);

  useEffect(() => {
    const units = [...new Set(items.map(item => item.unit))];
    setUniqueUnits(units);
  }, [items]);

  useEffect(() => {
    const regions = orgRegions.length ? orgRegions : [...new Set(items.map(item => item.region === 'Cumilla Zone' ? 'Comilla Zone' : item.region).filter(Boolean))];
    setUniqueRegions(regions);
  }, [items, orgRegions]);

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

  // Keyboard shortcuts for Manage Regions modal: Esc to cancel, Enter to add
  useEffect(() => {
    if (!isManageRegionsOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsManageRegionsOpen(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleAddRegion();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isManageRegionsOpen, newRegionName, selectedOrg]);

  // Keyboard shortcuts for Manage Organizations modal: Esc to cancel, Enter to add
  useEffect(() => {
    if (!isManageOrganizationsOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsManageOrganizationsOpen(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleAddOrganization();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isManageOrganizationsOpen, newOrgName]);

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

  // Export menu removed

  const fetchDivisions = async () => {
    const res = await apiClient.get(`/items/divisions`);
    setDivisions(res.data);
  };
  const fetchItems = async (organizationName) => {
    // Request a larger limit so the UI reflects full imports; include organization filter if provided
    const params = { limit: 1000000 };
    if (organizationName) params.organization = organizationName;
    const res = await apiClient.get(`/items`, { params });
    setItems(res.data);
  };
  const fetchSpecialItems = async (organizationName) => {
    try {
      setSpecialItemsLoading(true);
      setSpecialItemsError("");
      const params = { limit: 1000000 };
      if (organizationName) params.organization = organizationName;
      const res = await apiClient.get(`/items/special`, { params });
      setSpecialItems(res.data || []);
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to load special items";
      setSpecialItemsError(msg);
    } finally {
      setSpecialItemsLoading(false);
    }
  };

  const addDivision = async () => {
    if (!divisionName.trim()) {
      setAddDivisionError("Input field is empty");
      return;
    }
    const payload = { name: divisionName.trim(), organization_id: selectedOrg?.org_id };
    await apiClient.post(`/items/divisions`, payload);
    setDivisionName("");
    setAddDivisionError("");
    fetchDivisions();
    setIsAddDivisionModalOpen(false);
    setToast("Division added successfully");
    setTimeout(() => setToast(null), 2500);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleRegionRateChange = (region, value) => {
    setForm((prev) => ({ ...prev, regionRates: { ...prev.regionRates, [region]: value } }));
  };

  const divisionsForOrg = React.useMemo(() => {
    // Divisions are now common across organizations; show all divisions
    return divisions;
  }, [divisions]);

  const addItem = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    const hasAtLeastOneRate = Object.values(form.regionRates).some(v => String(v).trim() !== "");
    const requiredMissing = !form.division_id || !form.item_code.trim() || !form.item_description.trim() || !form.unit || !hasAtLeastOneRate;
    if (requiredMissing) {
      if (orgRegions.length === 0) {
        setAddItemError(`No regions for ${form.organization || selectedOrg?.name || "organization"}. Add a region first.`);
      } else {
        setAddItemError(!hasAtLeastOneRate ? "Provide at least one region rate" : "Input field is empty");
      }
      return;
    }
    const base = {
      item_code: form.item_code.trim(),
      item_description: form.item_description.trim(),
      unit: form.unit,
      division_id: parseInt(form.division_id, 10),
      organization: form.organization || "RHD",
    };
  const payloads = orgRegions
      .filter((region) => String(form.regionRates[region] || '').trim() !== '')
      .map((region) => ({ ...base, rate: parseFloat(form.regionRates[region]), region }));
    try {
      await Promise.all(payloads.map(p => apiClient.post(`/items`, p)));
    } catch (err) {
      setAddItemError("Failed to add one or more region rates");
      return;
    }
  setForm({ item_code: "", item_description: "", unit: "", division_id: "", organization: selectedOrg?.name || "", regionRates: makeInitialRegionRates(orgRegions) });
    setAddItemError("");
    fetchItems(selectedOrg?.name);
    setIsAddItemModalOpen(false);
    setToast("Item(s) added successfully");
    setTimeout(() => setToast(null), 2500);
  };

  const requestDeleteDivision = (division_id) => {
    setConfirmDeleteDivisionId(division_id);
    setIsConfirmDeleteDivisionOpen(true);
  };

  const deleteDivisionById = async () => {
    if (!confirmDeleteDivisionId) return;
    await apiClient.delete(`/items/divisions/${confirmDeleteDivisionId}`);
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

  // Add region/org handlers to support keyboard Enter and reuse in buttons
  const handleAddRegion = async () => {
    if (!newRegionName.trim()) { setAddRegionError('Input field is empty'); return; }
    if (!selectedOrg?.org_id) { setAddRegionError('Select an organization first'); return; }
    try {
      await createRegion(selectedOrg.org_id, newRegionName.trim());
      const regs = await listRegions(selectedOrg.org_id);
      setOrgRegionObjs(regs);
      setForm(f => ({ ...f, regionRates: makeInitialRegionRates(regs.map(r => r.name)) }));
      setNewRegionName('');
      setAddRegionError('');
      setIsManageRegionsOpen(false);
      setToast('Region added successfully');
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setAddRegionError('Region already exists or failed to add');
    }
  };

  const handleAddOrganization = async () => {
    if (!newOrgName.trim()) { setAddOrgError('Input field is empty'); return; }
    try {
      await createOrganization(newOrgName.trim());
      const orgs = await listOrganizations();
      setOrganizations(orgs);
      const created = orgs.find(o => o.name.toLowerCase() === newOrgName.trim().toLowerCase());
      if (created) await changeOrganization(created.org_id);
      setNewOrgName('');
      setAddOrgError('');
      setIsManageOrganizationsOpen(false);
      setToast('Organization added successfully');
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setAddOrgError('Organization already exists or failed to add');
    }
  };

  const deleteItemById = async () => {
    if (!confirmDeleteItemId) return;
    try {
      setIsDeletingItem(true);
      await apiClient.delete(`/items/${confirmDeleteItemId}`);
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
    await apiClient.put(`/items/${editItem.item_id}`, payload);
    setEditItem(null);
    setIsEditModalOpen(false);
    fetchItems(selectedOrg?.name);
  };

  const deleteItem = async (item_id) => {
    await apiClient.delete(`/items/${item_id}`);
    fetchItems(selectedOrg?.name);
  };

  const exportCSV = async () => {
    // Generate template CSV with headers only (no data)
    const headers = [
      "Item Code",
      "Division",
      "Description",
      "Unit",
      ...orgRegions,
      "Organization",
    ];
    const csv = headers.join(",") + "\n"; // headers row only
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'ItemMasterTemplate.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  // XLSX export removed along with Export menu

  const submitImport = async () => {
    if (!importFile) {
      setImportError('Please select a CSV or XLSX file.');
      return;
    }
    try {
      setIsImporting(true);
      setImportBanner({ type: 'info', message: 'Importing item master… Please wait.' });
      const res = await importItems(importFile, importMode, (evt) => {
        if (!evt.total) return;
        const pct = Math.round((evt.loaded / evt.total) * 100);
        setUploadProgress(pct);
      });
      const processed = res?.processed ?? null;
      const skipped = res?.skipped ?? 0;
      await fetchItems(selectedOrg?.name);
      setImportBanner({ type: skipped > 0 ? 'warning' : 'success', message: processed != null ? `Imported ${processed} item(s) successfully${skipped ? `, skipped ${skipped} (no rate).` : '.'}` : 'Import completed successfully.' });
      setImportFile(null);
      setImportError("");
      setUploadProgress(0);
    } catch (err) {
      console.error('Import failed:', err);
      const msg = err?.response?.data?.detail || 'Import failed. Please check the file format and try again.';
      setImportError(msg);
      setImportBanner({ type: 'error', message: msg });
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
    // Keep modal open; block interactions until import completes
    await submitImport();
  };

  // Auto-hide success/warning banners after a while; keep info/error until dismissed
  useEffect(() => {
    if (!importBanner) return;
    if (importBanner.type === 'info' || importBanner.type === 'error') return;
    const t = setTimeout(() => setImportBanner(null), 8000);
    return () => clearTimeout(t);
  }, [importBanner]);

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
        return item.region;
      default:
        return '';
    }
  };

  const isStringColumn = (col) => ['division', 'code', 'description', 'unit', 'region'].includes(col);
  const isNumberColumn = (col) => ['rate'].includes(col);

  const matchesSingleFilter = (item, f) => {
    const col = f.column;
    const op = f.operator;
    const val = f.value;
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
  const massFilterMatches = (item) => {
    if (!massFilters || massFilters.length === 0) return false;
    if (massFilterJoin === 'OR') {
      return massFilters.some(f => matchesSingleFilter(item, f));
    }
    // AND by default
    return massFilters.every(f => matchesSingleFilter(item, f));
  };

  const massFilteredItems = items.filter(massFilterMatches);
  const isMassFilterActive = Array.isArray(massFilters) && massFilters.some(f => String(f.value).trim() !== '');
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
      const results = await Promise.allSettled(ids.map(id => apiClient.delete(`/items/${id}`)));
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
        const results = await Promise.allSettled(batch.map(id => apiClient.delete(`/items/${id}`)));
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

  // Group items by Division + Code to pivot rates across regions
  const groupedMap = new Map();
  for (const it of items) {
    const key = `${it.division_id}|${it.item_code}`;
    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        division: it.division,
        division_id: it.division_id,
        item_code: it.item_code,
        item_description: it.item_description,
        unit: it.unit,
        organization: it.organization || "RHD",
        rates: {},
      });
    }
    const normalizedRegion = it.region;
    groupedMap.get(key).rates[normalizedRegion] = it.rate;
  }
  const groupedRows = Array.from(groupedMap.values());
  const groupedFilteredRows = groupedRows.filter(row => (
    (!search.division || (row.division?.name || '').toLowerCase().includes(search.division.toLowerCase())) &&
    (!search.code || row.item_code.toLowerCase().includes(search.code.toLowerCase())) &&
    (!search.description || row.item_description.toLowerCase().includes(search.description.toLowerCase())) &&
    (!search.unit || row.unit === search.unit) &&
    (!search.organization || (row.organization || '').toLowerCase().includes(search.organization.toLowerCase()))
  ));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = groupedFilteredRows.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(groupedFilteredRows.length / itemsPerPage);
  const showingStart = groupedFilteredRows.length ? indexOfFirstItem + 1 : 0;
  const showingEnd = Math.min(indexOfLastItem, groupedFilteredRows.length);

  // Make table fill viewport and scroll internally
  const tableScrollRef = useRef(null);
  const bottomPaginationRef = useRef(null);
  const [tableScrollHeight, setTableScrollHeight] = useState(null);
  // Single-select grouped row (Division + Code)
  const [selectedGroupKey, setSelectedGroupKey] = useState(null);
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false);
  const [editGroupForm, setEditGroupForm] = useState(null);
  // Row selection state
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [isItemDetailOpen, setIsItemDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [isDeleteSelectedConfirmOpen, setIsDeleteSelectedConfirmOpen] = useState(false);
  const [isConfirmDeleteGroupOpen, setIsConfirmDeleteGroupOpen] = useState(false);
  // Mass delete progress state
  const [massDeleteTotal, setMassDeleteTotal] = useState(0);
  const [massDeleteCompleted, setMassDeleteCompleted] = useState(0);
  const [massDeleteFailed, setMassDeleteFailed] = useState(0);

  const toggleSelectItem = (id) => {
    setSelectedItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const clearSelection = () => { setSelectedItemIds([]); setSelectedGroupKey(null); };
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
      const results = await Promise.allSettled(ids.map(id => apiClient.delete(`/items/${id}`)));
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

  // Helpers for grouped selection
  const parseGroupKey = (key) => {
    if (!key) return { division_id: null, item_code: null };
    const [divStr, code] = key.split('|');
    return { division_id: parseInt(divStr, 10), item_code: code };
  };
  const getItemsForGroup = (key) => {
    const { division_id, item_code } = parseGroupKey(key);
    return items.filter(it => String(it.division_id) === String(division_id) && String(it.item_code) === String(item_code));
  };
  const handleDuplicateSelectedGroup = () => {
    if (!selectedGroupKey) return;
    const groupItems = getItemsForGroup(selectedGroupKey);
    if (groupItems.length === 0) return;
    const any = groupItems[0];
    const rates = Object.fromEntries(orgRegions.map(r => [r, '']));
    for (const it of groupItems) {
      const r = it.region;
      rates[r] = it.rate ?? '';
    }
    setForm({
      division_id: any.division_id,
      item_code: any.item_code,
      item_description: any.item_description,
      unit: any.unit,
      organization: any.organization || 'RHD',
      regionRates: rates,
    });
    setIsAddItemModalOpen(true);
  };

  const beginEditSelectedGroup = () => {
    if (!selectedGroupKey) return;
    const groupItems = getItemsForGroup(selectedGroupKey);
    if (groupItems.length === 0) return;
    const any = groupItems[0];
  const rates = Object.fromEntries(orgRegions.map(r => [r, '']));
    for (const it of groupItems) {
      const r = it.region;
      rates[r] = it.rate ?? '';
    }
    setEditGroupForm({
      division_id: any.division_id,
      item_code: any.item_code,
      item_description: any.item_description,
      unit: any.unit,
      organization: any.organization || 'RHD',
      regionRates: rates,
    });
    setIsEditGroupModalOpen(true);
  };
  const saveEditGroup = async () => {
    if (!editGroupForm) return;
    const base = {
      item_code: editGroupForm.item_code.trim(),
      item_description: editGroupForm.item_description.trim(),
      unit: editGroupForm.unit,
      division_id: parseInt(editGroupForm.division_id, 10),
      organization: editGroupForm.organization || 'RHD',
    };
    const groupItems = getItemsForGroup(`${base.division_id}|${base.item_code}`);
    try {
      const ops = [];
  for (const region of orgRegions) {
        const val = editGroupForm.regionRates[region];
        const normalized = region;
        const existing = groupItems.find(it => it.region === normalized);
        if (existing) {
          ops.push(apiClient.put(`/items/${existing.item_id}`, { ...base, rate: val !== '' && val != null ? parseFloat(val) : null, region: existing.region }));
        } else if (String(val).trim() !== '') {
          ops.push(apiClient.post(`/items`, { ...base, rate: parseFloat(val), region: normalized }));
        }
      }
      await Promise.all(ops);
      setIsEditGroupModalOpen(false);
      setEditGroupForm(null);
      await fetchItems();
      setToast('Grouped item updated successfully');
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      console.error('Grouped update failed:', err);
      const msg = err?.response?.data?.detail || 'Failed to update grouped item.';
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
    }
  };
  const requestDeleteSelectedGroup = () => {
    if (!selectedGroupKey) return;
    setIsConfirmDeleteGroupOpen(true);
  };

  const deleteSelectedGroup = async () => {
    if (!selectedGroupKey) return;
    const groupItems = getItemsForGroup(selectedGroupKey);
    if (groupItems.length === 0) { setIsConfirmDeleteGroupOpen(false); return; }
    try {
      const results = await Promise.allSettled(groupItems.map(it => apiClient.delete(`/items/${it.item_id}`)));
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      await fetchItems();
      clearSelection();
      setIsConfirmDeleteGroupOpen(false);
      setToast(`Deleted ${succeeded} rate(s). Failed ${failed}.`);
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error('Grouped delete failed:', err);
      const msg = err?.response?.data?.detail || 'Failed to delete grouped item.';
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

  // Keyboard shortcuts for Confirm Delete Group: Esc to cancel, Enter to delete
  useEffect(() => {
    if (!isConfirmDeleteGroupOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); setIsConfirmDeleteGroupOpen(false); }
      else if (e.key === 'Enter') { e.preventDefault(); deleteSelectedGroup(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isConfirmDeleteGroupOpen, selectedGroupKey]);

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
      <div className="mb-6">
        <div className="flex items-center gap-6 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab("special")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              activeTab === "special"
                ? "border-[var(--color-primary-600)] text-[var(--color-primary-700)]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Special Item Master
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("items")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              activeTab === "items"
                ? "border-[var(--color-primary-600)] text-[var(--color-primary-700)]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Item Master
          </button>
        </div>
      </div>

      {activeTab === "special" && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
          {specialItemsLoading && <div className="text-sm text-gray-600">Loading special items...</div>}
          {specialItemsError && <div className="text-sm text-red-600">{specialItemsError}</div>}
          {!specialItemsLoading && !specialItemsError && (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">Division</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">Code</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">Description</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">Unit</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">Region</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700">Rate</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">Organization</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {specialItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                        No special items found
                      </td>
                    </tr>
                  )}
                  {specialItems.map((it) => (
                    <tr key={it.special_item_id} className="hover:bg-teal-50">
                      <td className="px-3 py-2 text-gray-800">{it.division?.name || "—"}</td>
                      <td className="px-3 py-2 text-gray-800">{it.item_code}</td>
                      <td className="px-3 py-2 text-gray-800">{it.item_description}</td>
                      <td className="px-3 py-2 text-gray-800">{it.unit || "—"}</td>
                      <td className="px-3 py-2 text-gray-800">{it.region}</td>
                      <td className="px-3 py-2 text-gray-800 text-right">{it.rate != null ? formatRate(it.rate) : ""}</td>
                      <td className="px-3 py-2 text-gray-800">{it.organization || "RHD"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "items" && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Item Master</h2>
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-2 mr-2">
                <label className="text-xs text-emerald-700 font-semibold">Organization:</label>
                <select
                  className="border border-gray-300 h-6 px-3 rounded text-xs"
                  value={selectedOrg?.org_id || ""}
                  onChange={(e) => changeOrganization(e.target.value)}
                >
                  <option value="">Select</option>
                  {organizations.map(o => (
                    <option key={o.org_id} value={o.org_id}>{o.name}</option>
                  ))}
                </select>
              </div>
              {isAdmin && (
                <>
                  <button onClick={() => setIsAddDivisionModalOpen(true)} className="bg-teal-700 hover:bg-teal-900 text-white text-xs font-extralight h-6 px-4 rounded inline-flex items-center gap-1">
                    <FaPlus className="w-3 h-3" />
                    <span>Add Division</span>
                  </button>
                  <button onClick={() => setIsAddItemModalOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-extralight h-6 px-4 rounded inline-flex items-center gap-1">
                    <FaPlus className="w-3 h-3" />
                    <span>Add Item</span>
                  </button>
                  <button
                    onClick={() => setIsManageRegionsOpen(true)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsManageRegionsOpen(true); } }}
                    className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 text-xs font-medium h-6 px-3 rounded inline-flex items-center gap-1"
                    aria-haspopup="dialog"
                  >
                    <FaPlus className="w-3 h-3" />
                    <span>Manage Regions</span>
                  </button>
                  <button
                    onClick={() => setIsManageOrganizationsOpen(true)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsManageOrganizationsOpen(true); } }}
                    className="bg-white border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-xs font-medium h-6 px-3 rounded inline-flex items-center gap-1"
                    aria-haspopup="dialog"
                  >
                    <FaPlus className="w-3 h-3" />
                    <span>Manage Orgs</span>
                  </button>
                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium h-6 px-4 rounded shadow-sm inline-flex items-center gap-1"
                  >
                    <FaUpload className="w-3 h-3" />
                    <span>Import Item</span>
                  </button>
                  <button
                    onClick={() => setIsMassDeleteModalOpen(true)}
                    className="bg-white border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-xs font-medium h-6 px-4 rounded shadow-sm inline-flex items-center gap-1"
                  >
                    Mass Delete
                  </button>
                </>
              )}
            </div>
          </div>
        {importBanner && (
        <div className={`mt-3 p-3 rounded-md border text-sm ${importBanner.type === 'error' ? 'bg-red-50 text-red-700 border-red-300' : importBanner.type === 'warning' ? 'bg-orange-50 text-orange-700 border-orange-300' : importBanner.type === 'info' ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300'}`}>
          <div className="flex justify-between items-start">
            <span>{importBanner.message}</span>
            <button className="text-xs opacity-70 hover:opacity-100" onClick={() => setImportBanner(null)}>Dismiss</button>
          </div>
        </div>
        )}

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
            <p className="text-xs text-gray-600 mb-3">Fill in item details including division, unit, and multi-region rates.</p>
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
                    {divisionsForOrg.length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-500">No divisions</div>
                    )}
                    {divisionsForOrg.map(d => (
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
              <div className="grid grid-cols-1 gap-2">
                <div className="text-xs text-gray-600">Organization (default)</div>
                <input
                  name="organization"
                  value={form.organization}
                  readOnly
                  className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none text-xs bg-gray-100"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {orgRegions.map((r) => (
                  <div key={r} className="flex items-center gap-2">
                    <label className="text-[11px] text-gray-700 whitespace-nowrap">{r}</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={form.regionRates[r]}
                      onChange={(e) => handleRegionRateChange(r, e.target.value)}
                      placeholder="Rate"
                      className="border border-gray-300 p-2 rounded w-full focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                    />
                  </div>
                ))}
                {orgRegions.length === 0 && (
                  <div className="text-xs text-gray-600">No regions defined for {form.organization || selectedOrg?.name || "organization"}. Use Manage Regions to add.</div>
                )}
              </div>
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
                  disabled={orgRegions.length === 0}
                  className={`${orgRegions.length === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-teal-700 hover:bg-teal-900'} text-white font-medium py-1 px-3 rounded inline-flex items-center gap-1 text-xs`}
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

      {isManageRegionsOpen && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-md z-50 relative border border-gray-200">
            <button onClick={() => setIsManageRegionsOpen(false)} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">Manage Regions</h2>
            <p className="text-xs text-gray-600 mb-3">Add zones for the selected organization.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600">Organization</label>
                <input className="border border-gray-300 p-2 rounded w-full text-xs bg-gray-100" readOnly value={selectedOrg?.name || ''} />
              </div>
              <div className="max-h-40 overflow-auto border border-gray-200 rounded p-2">
                {orgRegionObjs.length === 0 ? (
                  <div className="text-xs text-gray-500">No regions</div>
                ) : (
                  orgRegionObjs.map(r => (
                    <div key={r.region_id} className="group flex items-center justify-between text-xs py-2 px-2 rounded hover:bg-gray-50 border-b border-gray-100">
                      {editingRegionId === r.region_id ? (
                        <input
                          className="border border-gray-300 p-1 rounded w-2/3 text-xs"
                          value={editingRegionName}
                          onChange={(e) => setEditingRegionName(e.target.value)}
                        />
                      ) : (
                        <span className="font-medium text-gray-800">{r.name}</span>
                      )}
                      <div className="flex items-center gap-2">
                        {editingRegionId === r.region_id ? (
                          <>
                            <button
                              onClick={async () => {
                                const name = editingRegionName.trim();
                                if (!name) return;
                                try {
                                  await updateRegion(r.region_id, name);
                                  const regs = await listRegions(selectedOrg.org_id);
                                  setOrgRegionObjs(regs);
                                  setForm(f => ({ ...f, regionRates: makeInitialRegionRates(regs.map(rr => rr.name)) }));
                                  setEditingRegionId(null);
                                  setEditingRegionName("");
                                } catch (e) {
                                  console.error('Failed to update region', e);
                                }
                              }}
                              className="text-teal-700 hover:text-teal-900"
                            >Save</button>
                            <button
                              onClick={() => { setEditingRegionId(null); setEditingRegionName(""); }}
                              className="text-gray-600 hover:text-gray-800"
                            >Cancel</button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setEditingRegionId(r.region_id); setEditingRegionName(r.name); }}
                              className="text-gray-700 hover:text-gray-900 inline-flex items-center gap-1"
                            ><FaEdit className="w-3 h-3" />Edit</button>
                            <button
                              onClick={() => setConfirmDeleteRegionId(r.region_id)}
                              className="text-red-600 hover:text-red-800 inline-flex items-center gap-1"
                            ><FaTrash className="w-3 h-3" />Delete</button>
                          </>
                        )}
                      </div>
                      {confirmDeleteRegionId === r.region_id && (
                        <div className="mt-2 w-full text-[11px] text-gray-700">
                          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded p-2">
                            <span>Delete region \"{r.name}\"?</span>
                            <div className="flex gap-2">
                              <button onClick={() => setConfirmDeleteRegionId(null)} className="text-gray-700 hover:text-gray-900">Cancel</button>
                              <button
                                onClick={async () => {
                                  try {
                                    await deleteRegion(r.region_id);
                                    setConfirmDeleteRegionId(null);
                                    const regs = await listRegions(selectedOrg.org_id);
                                    setOrgRegionObjs(regs);
                                    setForm(f => ({ ...f, regionRates: makeInitialRegionRates(regs.map(rr => rr.name)) }));
                                  } catch (e) {
                                    console.error('Failed to delete region', e);
                                  }
                                }}
                                className="text-red-700 hover:text-red-900 font-semibold"
                              >Confirm</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div>
                <label className="text-xs text-gray-600">New Region Name</label>
                <input
                  className={`border ${addRegionError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'} p-2 rounded w-full text-xs`}
                  placeholder="e.g., Dhaka Zone"
                  value={newRegionName}
                  onChange={(e) => { setNewRegionName(e.target.value); if (addRegionError && e.target.value.trim()) setAddRegionError(''); }}
                />
                {addRegionError && <p className="mt-1 text-xs text-red-600">{addRegionError}</p>}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setIsManageRegionsOpen(false)} className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs">Cancel</button>
              <button onClick={handleAddRegion} className="bg-teal-700 hover:bg-teal-900 text-white font-medium py-1 px-3 rounded text-xs">Add Region</button>
            </div>
          </div>
        </div>
      )}

      {isManageOrganizationsOpen && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-md z-50 relative border border-gray-200">
            <button onClick={() => setIsManageOrganizationsOpen(false)} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">Manage Organizations</h2>
            <p className="text-xs text-gray-600 mb-3">Add or remove organizations and pick the active one.</p>
            <div className="space-y-3">
              <div className="max-h-40 overflow-auto border border-gray-200 rounded p-2">
                {organizations.length === 0 ? (
                  <div className="text-xs text-gray-500">No organizations</div>
                ) : (
                  organizations.map(o => (
                    <div key={o.org_id} className="group flex items-center justify-between text-xs py-2 px-2 rounded hover:bg-gray-50 border-b border-gray-100">
                      {editingOrgId === o.org_id ? (
                        <input
                          className="border border-gray-300 p-1 rounded w-2/3 text-xs"
                          value={editingOrgName}
                          onChange={(e) => setEditingOrgName(e.target.value)}
                        />
                      ) : (
                        <button className="text-left font-medium text-gray-800" onClick={() => changeOrganization(o.org_id)}>{o.name}</button>
                      )}
                      <div className="flex items-center gap-2">
                        {editingOrgId === o.org_id ? (
                          <>
                            <button
                              onClick={async () => {
                                const name = editingOrgName.trim();
                                if (!name) return;
                                try {
                                  await updateOrganization(o.org_id, name);
                                  const orgs = await listOrganizations();
                                  setOrganizations(orgs);
                                  setEditingOrgId(null);
                                  setEditingOrgName("");
                                } catch (e) {
                                  console.error('Failed to update organization', e);
                                }
                              }}
                              className="text-teal-700 hover:text-teal-900"
                            >Save</button>
                            <button
                              onClick={() => { setEditingOrgId(null); setEditingOrgName(""); }}
                              className="text-gray-600 hover:text-gray-800"
                            >Cancel</button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setEditingOrgId(o.org_id); setEditingOrgName(o.name); }}
                              className="text-gray-700 hover:text-gray-900 inline-flex items-center gap-1"
                            ><FaEdit className="w-3 h-3" />Edit</button>
                            <button
                              onClick={() => setConfirmDeleteOrgId(o.org_id)}
                              className="text-red-600 hover:text-red-800 inline-flex items-center gap-1"
                            ><FaTrash className="w-3 h-3" />Delete</button>
                          </>
                        )}
                      </div>
                      {confirmDeleteOrgId === o.org_id && (
                        <div className="mt-2 w-full text-[11px] text-gray-700">
                          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded p-2">
                            <span>Delete organization \"{o.name}\"?</span>
                            <div className="flex gap-2">
                              <button onClick={() => setConfirmDeleteOrgId(null)} className="text-gray-700 hover:text-gray-900">Cancel</button>
                              <button
                                onClick={async () => {
                                  try {
                                    await deleteOrganization(o.org_id);
                                    setConfirmDeleteOrgId(null);
                                    const orgs = await listOrganizations();
                                    setOrganizations(orgs);
                                    const newSel = orgs.find(x => x.org_id === selectedOrg?.org_id) || orgs[0] || null;
                                    await changeOrganization(newSel?.org_id || "");
                                  } catch (e) {
                                    console.error('Failed to delete organization', e);
                                  }
                                }}
                                className="text-red-700 hover:text-red-900 font-semibold"
                              >Confirm</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div>
                <label className="text-xs text-gray-600">New Organization Name</label>
                <input
                  className={`border ${addOrgError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'} p-2 rounded w-full text-xs`}
                  placeholder="e.g., LGED"
                  value={newOrgName}
                  onChange={(e) => { setNewOrgName(e.target.value); if (addOrgError && e.target.value.trim()) setAddOrgError(''); }}
                />
                {addOrgError && <p className="mt-1 text-xs text-red-600">{addOrgError}</p>}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setIsManageOrganizationsOpen(false)} className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs">Cancel</button>
              <button onClick={handleAddOrganization} className="bg-teal-700 hover:bg-teal-900 text-white font-medium py-1 px-3 rounded text-xs">Add Organization</button>
            </div>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-xl z-50 relative border border-gray-200">
            <button onClick={() => setIsImportModalOpen(false)} disabled={isImporting} className={`absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full ${isImporting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'} transition`}>
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
                  className={`border-2 rounded-lg p-5 text-center cursor-pointer transition shadow-sm ${isImportDragging ? 'border-teal-400 bg-teal-50' : 'border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100'} ${importError ? 'border-red-400 bg-red-50' : ''}`}
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
                    className={`${isImporting ? 'opacity-70 cursor-not-allowed' : ''} inline-flex items-center gap-2 px-3 py-2 bg-teal-700 text-white rounded-md text-xs hover:bg-teal-900`}
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
                  <button type="button" onClick={downloadTemplateCSV} className="text-xs text-emerald-700 hover:text-emerald-900 underline">Download CSV template</button>
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
                  className={`${isImporting ? 'opacity-70 cursor-not-allowed' : ''} bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold text-sm py-1 px-4 rounded-md`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportClick}
                  disabled={isImporting}
                  className={`${isImporting ? 'opacity-70 cursor-not-allowed' : ''} bg-teal-700 hover:bg-teal-900 text-white font-semibold text-sm py-1 px-6 rounded-md`}
                >
                  {isImporting ? 'Importing…' : 'Import'}
                </button>
              </div>
              {isImporting && (
                <div className="mt-3">
                  <div className="h-2 bg-gray-200 rounded">
                    <div className="h-2 bg-teal-600 rounded" style={{ width: `${uploadProgress || 10}%`, transition: 'width 200ms' }}></div>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-600">{uploadProgress ? `Uploading… ${uploadProgress}%` : 'Processing file…'}</div>
                </div>
              )}
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
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-600">Match</span>
                    <select
                      value={massFilterJoin}
                      onChange={(e)=>setMassFilterJoin(e.target.value)}
                      className="border p-1 rounded text-xs"
                    >
                      <option value="AND">All (AND)</option>
                      <option value="OR">Any (OR)</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMassFilters(prev => [...prev, { column: 'code', operator: 'equals', value: '' }])}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-2 py-1 rounded"
                >Add Filter</button>
              </div>
              <div className="space-y-2">
                {massFilters.map((f, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 items-end">
                    <div>
                      <label className="text-xs text-gray-700">Column</label>
                      <select
                        value={f.column}
                        onChange={(e)=>{
                          const col = e.target.value;
                          setMassFilters(prev => prev.map((pf,i)=> i===idx ? { ...pf, column: col, operator: 'equals', value: '' } : pf));
                        }}
                        className="w-full border p-2 rounded text-xs"
                      >
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
                      <select
                        value={f.operator}
                        onChange={(e)=>setMassFilters(prev => prev.map((pf,i)=> i===idx ? { ...pf, operator: e.target.value } : pf))}
                        className="w-full border p-2 rounded text-xs"
                      >
                        {isStringColumn(f.column) && (
                          <>
                            <option value="equals">Equals</option>
                            <option value="not_equals">Not Equals</option>
                            <option value="contains">Contains</option>
                            <option value="starts_with">Starts With</option>
                            <option value="ends_with">Ends With</option>
                          </>
                        )}
                        {isNumberColumn(f.column) && (
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
                      <input
                        type={isNumberColumn(f.column) ? 'number' : 'text'}
                        value={f.value}
                        onChange={(e)=>setMassFilters(prev => prev.map((pf,i)=> i===idx ? { ...pf, value: e.target.value } : pf))}
                        className="w-full border p-2 rounded text-xs"
                        placeholder={isNumberColumn(f.column) ? 'Enter number' : 'Enter text'}
                      />
                    </div>
                    <div className="col-span-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setMassFilters(prev => prev.filter((_, i) => i !== idx))}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs px-2 py-1 rounded"
                        disabled={massFilters.length === 1}
                        title={massFilters.length === 1 ? 'At least one filter required' : 'Remove this filter'}
                      >Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-2">Matching items: <span className="font-medium">{isMassFilterActive ? massFilteredItems.length : filteredItems.length}</span></p>
            {/* Removed sample list to simplify modal; users can refine filters instead */}
            {isMassDeleteConfirmOpen && (
              <div className="mb-4 border border-red-200 bg-red-50 rounded-md px-3 py-2">
                <p className="text-xs text-red-700 mb-2">This will delete <span className="font-semibold">{deleteCandidates.length}</span> item(s) permanently. Continue?</p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMassDeleteConfirmOpen(false)}
                    disabled={isMassDeleting}
                    className={`${isMassDeleting ? 'opacity-70 cursor-not-allowed' : ''} bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold text-xs py-1 px-3 rounded-md`}
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
                className={`${isMassDeleting ? 'opacity-70 cursor-not-allowed' : ''} bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold text-sm py-1 px-4 rounded-md`}
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
                  {isAdmin && <th className="px-2 py-1 text-center text-xs font-bold border-r min-w-[40px] text-gray-800 border-gray-200">Sel</th>}
                  <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Division</th>
                  <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Code</th>
                  <th className="px-2 py-1 text-left text-xs font-bold border-r w-[30%] text-gray-800 border-gray-200">Description</th>
                  <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Unit</th>
                  <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[140px] text-gray-800 border-gray-200">Organization</th>
  {orgRegions.map((r) => (
                    <th key={r} className="px-2 py-1 text-right text-xs font-bold border-r min-w-[140px] text-gray-800 border-gray-200">{r}</th>
                  ))}
                </tr>
                <tr>
                  {isAdmin && <th className="px-2 py-1 border-r min-w-[40px] border-gray-200"></th>}
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
                  <th className="px-2 py-1 border-r min-w-[140px] border-gray-200">
                    <input type="text" placeholder="Search..." value={search.organization} onChange={(e) => setSearch({ ...search, organization: e.target.value })} className="w-full text-xs px-2 py-1 border rounded-md transition-colors bg-white text-gray-900 border-gray-300 placeholder-gray-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-200" />
                  </th>
  {orgRegions.map((r) => (
                    <th key={r} className="px-2 py-1 border-r min-w-[140px] border-gray-200"></th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {groupedRows.length === 0 ? (
                  <tr>
  <td colSpan={5 + orgRegions.length} className="p-4 sm:p-8 text-center text-gray-600">
                      <div className="flex flex-col items-center">
                        <div className="text-lg mb-2">📭</div>
                        <div className="text-sm font-medium">No data found</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentItems
                    .map((row, i) => (
                      <tr key={`${row.item_code}|${row.division_id ?? row.division?.name ?? i}`} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-teal-50 transition-colors`}>
                        {isAdmin && (
                          <td className="px-2 py-1 text-center border-r border-gray-200">
                            <input
                              type="checkbox"
                              checked={selectedGroupKey === `${row.division_id}|${row.item_code}`}
                              onChange={() => setSelectedGroupKey(prev => prev === `${row.division_id}|${row.item_code}` ? null : `${row.division_id}|${row.item_code}`)}
                            />
                          </td>
                        )}
                        <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{row.division?.name ?? "—"}</td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{row.item_code}</td>
                        <td className="px-2 py-1 whitespace-normal break-words text-xs border-r text-gray-800 border-gray-200 max-w-[28rem]" title={row.item_description}>{row.item_description}</td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{row.unit}</td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{row.organization || 'RHD'}</td>
  {orgRegions.map((r) => (
                          <td key={r} className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200 text-right">{row.rates[r] != null && row.rates[r] !== '' ? formatRate(row.rates[r]) : ''}</td>
                        ))}
                      </tr>
                    ))
                )}
              </tbody>
            </table>
            {selectedGroupKey && (
              <div className="sticky bottom-0 z-20 bg-gray-800 text-white px-3 py-2 border-t border-gray-700 flex items-center justify-between">
                <div className="text-xs">1 grouped item selected</div>
                <div className="flex items-center gap-2">
                  <button className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-3 py-1 rounded" onClick={() => beginEditSelectedGroup()}>Edit</button>
                  <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1 rounded" onClick={() => handleDuplicateSelectedGroup()}>Duplicate</button>
                  <button className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded" onClick={() => requestDeleteSelectedGroup()}>Delete</button>
                  <button className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-3 py-1 rounded" onClick={clearSelection}>Clear selection</button>
                </div>
              </div>
            )}
            {!selectedGroupKey && isSearchActive() && (
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
          {new Intl.NumberFormat('en-US').format(groupedFilteredRows.length)} rows
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
                  className={`px-2 py-1 border rounded text-xs ${p === currentPage ? 'bg-teal-600 text-white border-teal-600' : 'hover:bg-gray-100 text-gray-600'}`}
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
            <h2 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Edit Item</h2>
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
            <div className="flex justify-end mt-6 gap-3">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs"
              >
                Cancel
              </button>
              <button
                onClick={updateItem}
                className="bg-teal-700 hover:bg-teal-900 text-white font-medium py-1 px-3 rounded inline-flex items-center gap-1 text-xs"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditGroupModalOpen && editGroupForm && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-3xl z-50 relative border border-gray-200">
            <button onClick={() => setIsEditGroupModalOpen(false)} className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition">✕</button>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-gray-900">Edit Grouped Item Rates</h2>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <select name="division_id" value={editGroupForm.division_id} onChange={(e) => setEditGroupForm({ ...editGroupForm, division_id: e.target.value })} className="border border-gray-300 p-3 rounded-lg col-span-1 focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">Division</option>
                {divisions.map(d => <option key={d.division_id} value={d.division_id}>{d.name}</option>)}
              </select>
              <input name="item_code" value={editGroupForm.item_code} onChange={(e) => setEditGroupForm({ ...editGroupForm, item_code: e.target.value })} placeholder="Code" className="border border-gray-300 p-3 rounded-lg col-span-1 focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <input name="item_description" value={editGroupForm.item_description} onChange={(e) => setEditGroupForm({ ...editGroupForm, item_description: e.target.value })} placeholder="Description" className="border border-gray-300 p-3 rounded-lg col-span-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <select name="unit" value={editGroupForm.unit} onChange={(e) => setEditGroupForm({ ...editGroupForm, unit: e.target.value })} className="border border-gray-300 p-3 rounded-lg col-span-1 focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">Select Unit</option>
                {uniqueUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              </select>
              <input name="organization" value={editGroupForm.organization} onChange={(e) => setEditGroupForm({ ...editGroupForm, organization: e.target.value })} placeholder="Organization" className="border border-gray-300 p-3 rounded-lg col-span-1 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Region Rates</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
  {orgRegions.map((r) => (
                  <div key={r} className="flex items-center gap-2">
                    <label className="w-40 text-xs text-gray-700">{r}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editGroupForm.regionRates[r] ?? ''}
                      onChange={(e) => setEditGroupForm(prev => ({ ...prev, regionRates: { ...prev.regionRates, [r]: e.target.value } }))}
                      className="border border-gray-300 p-2 rounded-lg text-xs flex-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Rate"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end mt-6 gap-2">
              <button onClick={() => setIsEditGroupModalOpen(false)} className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs">Cancel</button>
              <button onClick={saveEditGroup} className="bg-teal-700 hover:bg-teal-900 text-white font-medium py-1 px-3 rounded inline-flex items-center gap-1 text-xs">Save</button>
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

      {isConfirmDeleteGroupOpen && (
        <div className="fixed inset-0 bg-black/20 flex justify-center items-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w/full max-w-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Delete Grouped Rates</h3>
            <p className="text-xs text-gray-600 mb-4">Delete all region rates for this item code in the selected division? This may remove multiple rows and cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsConfirmDeleteGroupOpen(false)}
                className="bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold py-1 px-3 rounded shadow-sm text-xs"
              >
                Cancel
              </button>
              <button
                onClick={deleteSelectedGroup}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
