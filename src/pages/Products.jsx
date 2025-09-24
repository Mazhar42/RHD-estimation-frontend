import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaEdit, FaTrash } from "react-icons/fa";

const API = import.meta.env.VITE_API_BASE || "https://rhd-estimation-backend.onrender.com";

export default function Products() {
  const [isAddDivisionModalOpen, setIsAddDivisionModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [divisions, setDivisions] = useState([]);
  const [items, setItems] = useState([]);
  const [divisionName, setDivisionName] = useState("");
  const [form, setForm] = useState({ item_code: "", item_description: "", unit: "", rate: "", division_id: "" });
  const [editItem, setEditItem] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [search, setSearch] = useState({ division: "", code: "", description: "", unit: "", rate: "", rateOperator: "==" });
  const [uniqueUnits, setUniqueUnits] = useState([]);
  const [isAddingNewUnit, setIsAddingNewUnit] = useState(false);
  const [newUnit, setNewUnit] = useState("");

  useEffect(() => {
    fetchDivisions();
    fetchItems();
  }, []);

  useEffect(() => {
    const units = [...new Set(items.map(item => item.unit))];
    setUniqueUnits(units);
  }, [items]);

  const fetchDivisions = async () => {
    const res = await axios.get(`${API}/items/divisions`);
    setDivisions(res.data);
  };
  const fetchItems = async () => {
    const res = await axios.get(`${API}/items`);
    setItems(res.data);
  };

  const addDivision = async () => {
    if (!divisionName) return;
    await axios.post(`${API}/items/divisions`, { name: divisionName });
    setDivisionName("");
    fetchDivisions();
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const addItem = async (e) => {
    e.preventDefault();
    const payload = { ...form, rate: form.rate ? parseFloat(form.rate) : null, division_id: parseInt(form.division_id) };
    await axios.post(`${API}/items`, payload);
    setForm({ item_code: "", item_description: "", unit: "", rate: "", division_id: "" });
    fetchItems();
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



  return (
    <div className="bg-white rounded shadow">
      <div className="flex justify-between items-center m-4">
        <h2 className="text-xl font-semibold">Item Master</h2>
        <div className="flex gap-2">
          <button onClick={() => setIsAddDivisionModalOpen(true)} className="bg-teal-700 hover:bg-teal-900 text-white font-extralight py-1 px-4 rounded">
            Add Division
          </button>
          <button onClick={() => setIsAddItemModalOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white font-extralight py-1 px-4 rounded">
            Add Item
          </button>
        </div>
      </div>

      {isAddDivisionModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-gray-100 p-8 rounded-lg shadow-xl w-1/3 z-50 relative">
            <button onClick={() => setIsAddDivisionModalOpen(false)} className="absolute top-0 right-0 mt-4 mr-4 text-gray-600 hover:text-gray-800">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">Add New Division</h2>
            <div className="flex gap-4 mt-4">
              <input
                className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={divisionName}
                onChange={(e) => setDivisionName(e.target.value)}
                placeholder="New division name"
              />
              <button
                onClick={addDivision}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddItemModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-gray-100 p-8 rounded-lg shadow-xl w-1/3 z-50 relative">
            <button onClick={() => setIsAddItemModalOpen(false)} className="absolute top-0 right-0 mt-4 mr-4 text-gray-600 hover:text-gray-800">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">Add New Item</h2>
            <form onSubmit={addItem} className="grid grid-cols-6 gap-4 mt-4">
              <select
                name="division_id"
                value={form.division_id}
                onChange={handleChange}
                className="border border-gray-300 p-3 rounded-lg col-span-6 sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select Division</option>
                {divisions.map(d => <option key={d.division_id} value={d.division_id}>{d.name}</option>)}
              </select>
              <input
                name="item_code"
                value={form.item_code}
                onChange={handleChange}
                placeholder="Item Code"
                className="border border-gray-300 p-3 rounded-lg col-span-3 sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                className="border border-gray-300 p-3 rounded-lg col-span-3 sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select Unit</option>
                {uniqueUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                <option value="add_new_unit">Add New Unit</option>
              </select>
              {isAddingNewUnit && (
                <div className="col-span-4 flex items-center">
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
                        setForm({ ...form, unit: newUnit });
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
              <input
                name="item_description"
                value={form.item_description}
                onChange={handleChange}
                placeholder="Item Description"
                className="border border-gray-300 p-3 rounded-lg col-span-6 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <input
                name="rate"
                value={form.rate}
                onChange={handleChange}
                placeholder="Rate"
                className="border border-gray-300 p-3 rounded-lg col-span-3 sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <div className="col-span-6 text-right">
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="border rounded-lg flex flex-col border-gray-200">
        <div className="overflow-x-auto w-full">
          <div className="max-h-[75vh] overflow-auto">
            <table className="min-w-full border-collapse table-fixed">
              <thead className="sticky top-0 z-10 bg-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Division</th>
                  <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Code</th>
                  <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Description</th>
                  <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Unit</th>
                  <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Rate</th>
                  <th className="px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] text-gray-800 border-gray-200">Actions</th>
                </tr>
                <tr>
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
                  <th className="px-2 py-1 border-r min-w-[120px] sm:min-w-[150px] border-gray-200"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-4 sm:p-8 text-center text-gray-600">
                      <div className="flex flex-col items-center">
                        <div className="text-lg mb-2">📭</div>
                        <div className="text-sm font-medium">No data found</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items
                    .filter(item => {
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
                        (search.rate === '' || rateMatch)
                      );
                    })
                    .map((it, i) => (
                      <tr key={it.item_id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-teal-50 transition-colors`}>
                        <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{it.division?.name ?? "—"}</td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{it.item_code}</td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{it.item_description}</td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{it.unit}</td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">{it.rate}</td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs border-r text-gray-800 border-gray-200">
                          <button onClick={() => handleEdit(it)} className="edit-btn p-1 text-teal-500 hover:text-teal-700"><FaEdit /></button>
                          <button onClick={() => deleteItem(it.item_id)} className="delete-btn p-1 text-red-500 hover:text-red-700"><FaTrash /></button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isEditModalOpen && editItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-gray-100 p-8 rounded-lg shadow-xl w-1/3 z-50 relative">
            <button onClick={() => setIsEditModalOpen(false)} className="absolute top-0 right-0 mt-4 mr-4 text-gray-600 hover:text-gray-800">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">Edit Item</h2>
            <div className="grid grid-cols-2 gap-4 mt-4">
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
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={updateItem} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
