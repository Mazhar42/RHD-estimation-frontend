import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API = import.meta.env.VITE_API_BASE || "https://rhd-estimation-backend.onrender.com";

export default function EstimationDetail() {
  const { estimationId } = useParams();
  const [lines, setLines] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectedLineIds, setSelectedLineIds] = useState([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddLineModalOpen, setIsAddLineModalOpen] = useState(false);
  const [editingLine, setEditingLine] = useState(null);

  useEffect(() => {
    fetchItems();
    fetchLines();
  }, [estimationId]);

  const fetchItems = async () => {
    const res = await axios.get(`${API}/items`);
    setItems(res.data);
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

  const handleDeleteSelected = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedLineIds.length} line(s)?`)) {
      try {
        await axios.delete(`${API}/estimations/lines`, { data: { line_ids: selectedLineIds } });
        fetchLines();
        setSelectedLineIds([]);
      } catch (error) {
        console.error("Failed to delete lines", error);
        alert("Failed to delete lines.");
      }
    }
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

  const downloadPdf = () => {
    const doc = new jsPDF();
    const grandTotal = lines.reduce((sum, line) => sum + (line.amount || 0), 0);
    let isFirstTable = true;

    Object.entries(groupedLines).forEach(([divisionName, divisionLines]) => {
      if (!isFirstTable) {
        doc.addPage();
      }
      isFirstTable = false;

      doc.text(divisionName, 14, 15);
      const divisionSubtotal = divisionLines.reduce((sum, line) => sum + (line.amount || 0), 0);
      const body = divisionLines.map(l => [
        l.item?.item_code || '',
        l.item?.item_description || '',
        l.sub_description || '',
        l.no_of_units || '',
        l.length || '',
        l.width || '',
        l.thickness || '',
        l.quantity || '',
        l.calculated_qty || '',
        l.rate || '',
        l.item?.unit || '',
        l.amount || '',
      ]);

      autoTable(doc, {
        startY: 20,
        head: [["Item Code", "Description", "Sub Desc", "No.", "Length", "Width", "Thickness", "Quantity", "Calc Qty", "Rate", "Unit", "Amount"]],
        body: body,
        foot: [['Subtotal', '', '', '', '', '', '', '', '', '', '', divisionSubtotal.toFixed(2)]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [22, 160, 133] },
      });
    });
    
    // Add grand total
    const finalY = doc.lastAutoTable.finalY || 10;
    doc.text(`Grand Total: ${grandTotal.toFixed(2)}`, 14, finalY + 10);

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

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-lg font-semibold mb-4">Estimation #{estimationId}</h2>

      <div className="my-4 flex gap-2">
        <button
          onClick={() => setIsAddLineModalOpen(true)}
          className="bg-teal-600 text-white px-4 py-2 rounded"
        >
          Add Line
        </button>
        <button
          onClick={handleDeleteSelected}
          disabled={selectedLineIds.length === 0}
          className="bg-red-600 text-white px-4 py-2 rounded mr-2 disabled:bg-gray-400"
        >
          Delete Selected ({selectedLineIds.length})
        </button>
        <button
          onClick={openEditModal}
          disabled={selectedLineIds.length !== 1}
          className="bg-teal-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          Edit
        </button>
        <button
          onClick={downloadXlsx}
          disabled={!lines.length}
          className="bg-teal-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          Download XLSX
        </button>
        <button
          onClick={downloadPdf}
          disabled={!lines.length}
          className="bg-teal-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          Download PDF
        </button>
      </div>

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
            <div className="text-right font-bold mt-2">Subtotal for {divisionName}: {divisionSubtotal.toFixed(2)}</div>
          </div>
        );
      })}

      <div className="text-right text-xl font-bold mt-4">Grand Total: {total.toFixed(2)}</div>

      {isAddLineModalOpen && (
        <AddLineModal
          items={items}
          onClose={() => setIsAddLineModalOpen(false)}
          onSave={fetchLines}
          estimationId={estimationId}
        />
      )}

      {isEditModalOpen && (
        <EditLineModal
          line={editingLine}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleUpdateLine}
        />
      )}
    </div>
  );
}

function AddLineModal({ items, onClose, onSave, estimationId }) {
  const [form, setForm] = useState({ item_id: "", sub_description: "", no_of_units: 1, length: "", width: "", thickness: "", quantity: "" });

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
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h3 className="text-lg font-semibold mb-4">Add New Line</h3>
        <form onSubmit={addLine}>
          <div className="grid grid-cols-2 gap-4">
            <select name="item_id" value={form.item_id} onChange={handleChange} className="border p-2 rounded col-span-2">
              <option value="">Select product</option>
              {items.map(it => <option key={it.item_id} value={it.item_id}>{it.item_code} — {it.item_description}</option>)}
            </select>
            <input name="sub_description" value={form.sub_description} onChange={handleChange} placeholder="Sub description" className="border p-2 rounded col-span-2" />
            <input name="no_of_units" value={form.no_of_units} onChange={handleChange} placeholder="No" className="border p-2 rounded" />
            <input name="quantity" value={form.quantity} onChange={handleChange} placeholder="Quantity (direct)" className="border p-2 rounded" />
            <input name="length" value={form.length} onChange={handleChange} placeholder="Length" className="border p-2 rounded" />
            <input name="width" value={form.width} onChange={handleChange} placeholder="Width" className="border p-2 rounded" />
            <input name="thickness" value={form.thickness} onChange={handleChange} placeholder="Thickness" className="border p-2 rounded" />
          </div>
          <div className="mt-6 flex justify-end gap-4">
            <button type="button" onClick={onClose} className="bg-gray-300 text-black px-4 py-2 rounded">Cancel</button>
            <button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded">Add Line</button>
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h3 className="text-lg font-semibold mb-4">Edit Line Item</h3>
        <p className="mb-2 text-sm text-gray-600">Item: {line.item.item_code} - {line.item.item_description}</p>
        <p className="mb-4 text-sm text-gray-600">Rate: {line.rate} (fixed)</p>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <input name="sub_description" value={editForm.sub_description} onChange={handleChange} placeholder="Sub description" className="border p-2 rounded col-span-2" />
            <input name="no_of_units" value={editForm.no_of_units} onChange={handleChange} placeholder="No" className="border p-2 rounded" />
            <input name="quantity" value={editForm.quantity} onChange={handleChange} placeholder="Quantity (direct)" className="border p-2 rounded" />
            <input name="length" value={editForm.length} onChange={handleChange} placeholder="Length" className="border p-2 rounded" />
            <input name="width" value={editForm.width} onChange={handleChange} placeholder="Width" className="border p-2 rounded" />
            <input name="thickness" value={editForm.thickness} onChange={handleChange} placeholder="Thickness" className="border p-2 rounded" />
          </div>
          <div className="mt-6 flex justify-end gap-4">
            <button type="button" onClick={onClose} className="bg-gray-300 text-black px-4 py-2 rounded">Cancel</button>
            <button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
