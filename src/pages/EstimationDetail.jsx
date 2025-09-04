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
  const [form, setForm] = useState({ item_id: "", sub_description: "", no_of_units: 1, length: "", width: "", thickness: "", quantity: "" });
  const [total, setTotal] = useState(0);
  const [selectedLineIds, setSelectedLineIds] = useState([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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
    setForm({ item_id: "", sub_description: "", no_of_units: 1, length: "", width: "", thickness: "", quantity: "" });
    fetchLines();
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
    const dataToExport = lines.map(l => ({
      "Item Code": l.item?.item_code,
      "Description": l.item?.item_description,
      "Sub Desc": l.sub_description,
      "No.": l.no_of_units,
      "Length": l.length,
      "Width": l.width,
      "Thickness": l.thickness,
      "Quantity": l.quantity,
      "Calc Qty": l.calculated_qty,
      "Rate": l.rate,
      "Unit": l.item?.unit,
      "Amount": l.amount,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estimation Lines");
    XLSX.writeFile(wb, `estimation_${estimationId}_lines.xlsx`);
  };

  const downloadPdf = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [["Item Code", "Description", "Sub Desc", "No.", "Length", "Width", "Thickness", "Quantity", "Calc Qty", "Rate", "Unit", "Amount"]],
      body: lines.map(l => [
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
      ]),
    });
    doc.save(`estimation_${estimationId}_lines.pdf`);
  };

  console.log('lines:', lines);

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-lg font-semibold mb-4">Estimation #{estimationId}</h2>

      <form onSubmit={addLine} className="grid grid-cols-6 gap-2 mb-4">
        <select name="item_id" value={form.item_id} onChange={handleChange} className="border p-2 rounded col-span-2">
          <option value="">Select product</option>
          {items.map(it => <option key={it.item_id} value={it.item_id}>{it.item_code} — {it.item_description}</option>)}
        </select>
        <input name="sub_description" value={form.sub_description} onChange={handleChange} placeholder="Sub description" className="border p-2 rounded col-span-2" />
        <input name="no_of_units" value={form.no_of_units} onChange={handleChange} placeholder="No" className="border p-2 rounded col-span-1" />
        <input name="quantity" value={form.quantity} onChange={handleChange} placeholder="Quantity (direct)" className="border p-2 rounded col-span-1" />

        <input name="length" value={form.length} onChange={handleChange} placeholder="Length" className="border p-2 rounded col-span-1" />
        <input name="width" value={form.width} onChange={handleChange} placeholder="Width" className="border p-2 rounded col-span-1" />
        <input name="thickness" value={form.thickness} onChange={handleChange} placeholder="Thickness" className="border p-2 rounded col-span-1" />

        <div className="col-span-6 text-right">
          <button className="bg-green-600 text-white px-4 py-2 rounded">Add Line</button>
        </div>
      </form>

      <div className="my-4 flex gap-2">
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
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          Edit
        </button>
        <button
          onClick={downloadXlsx}
          disabled={!lines.length}
          className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          Download XLSX
        </button>
        <button
          onClick={downloadPdf}
          disabled={!lines.length}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          Download PDF
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 w-4">
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={lines.length > 0 && selectedLineIds.length === lines.length}
                />
              </th>
              <th className="p-2">Item Code</th>
              <th className="p-2">Description</th>
              <th className="p-2">Sub Desc</th>
              <th className="p-2">No.</th>
              <th className="p-2">Length</th>
              <th className="p-2">Width</th>
              <th className="p-2">Thickness</th>
              <th className="p-2">Quantity</th>
              <th className="p-2">Calc Qty</th>
              <th className="p-2">Rate</th>
              <th className="p-2">Unit</th>
              <th className="p-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => (
              <tr key={l.line_id} className={`border-b ${selectedLineIds.includes(l.line_id) ? 'bg-blue-100' : ''}`}>
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selectedLineIds.includes(l.line_id)}
                    onChange={() => handleSelectLine(l.line_id)}
                  />
                </td>
                <td className="p-2">{l.item?.item_code}</td>
                <td className="p-2">{l.item?.item_description}</td>
                <td className="p-2">{l.sub_description}</td>
                <td className="p-2">{l.no_of_units}</td>
                <td className="p-2">{l.length}</td>
                <td className="p-2">{l.width}</td>
                <td className="p-2">{l.thickness}</td>
                <td className="p-2">{l.quantity}</td>
                <td className="p-2">{l.calculated_qty}</td>
                <td className="p-2">{l.rate}</td>
                <td className="p-2">{l.item?.unit}</td>
                <td className="p-2">{l.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-right text-xl font-bold mt-4">Grand Total: {total}</div>

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
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
