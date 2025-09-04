import React, { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export default function Products() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [catName, setCatName] = useState("");
  const [form, setForm] = useState({ item_code: "", item_description: "", unit: "", rate: "", category_id: "" });

  useEffect(() => {
    fetchCategories();
    fetchItems();
  }, []);

  const fetchCategories = async () => {
    const res = await axios.get(`${API}/items/categories`);
    setCategories(res.data);
  };
  const fetchItems = async () => {
    const res = await axios.get(`${API}/items`);
    setItems(res.data);
  };

  const addCategory = async () => {
    if (!catName) return;
    await axios.post(`${API}/items/categories`, { name: catName });
    setCatName("");
    fetchCategories();
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const addItem = async (e) => {
    e.preventDefault();
    const payload = { ...form, rate: form.rate ? parseFloat(form.rate) : null, category_id: parseInt(form.category_id) };
    await axios.post(`${API}/items`, payload);
    setForm({ item_code: "", item_description: "", unit: "", rate: "", category_id: "" });
    fetchItems();
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-lg font-semibold mb-4">Product Master</h2>
      <div className="mb-4">
        <h3 className="font-medium">Add Category</h3>
        <div className="flex gap-2 mt-2">
          <input className="border p-2 rounded w-64" value={catName} onChange={(e)=>setCatName(e.target.value)} placeholder="Division / Category name" />
          <button onClick={addCategory} className="bg-blue-600 text-white px-4 rounded">Add</button>
        </div>
      </div>

      <form onSubmit={addItem} className="mb-6 grid grid-cols-6 gap-2">
        <select name="category_id" value={form.category_id} onChange={handleChange} className="border p-2 rounded col-span-1">
          <option value="">Category</option>
          {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
        </select>
        <input name="item_code" value={form.item_code} onChange={handleChange} placeholder="Code" className="border p-2 rounded col-span-1" />
        <input name="item_description" value={form.item_description} onChange={handleChange} placeholder="Description" className="border p-2 rounded col-span-2" />
        <input name="unit" value={form.unit} onChange={handleChange} placeholder="Unit" className="border p-2 rounded col-span-1" />
        <input name="rate" value={form.rate} onChange={handleChange} placeholder="Rate" className="border p-2 rounded col-span-1" />
        <div className="col-span-6 text-right">
          <button className="bg-green-600 text-white px-4 py-2 rounded">Add Item</button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Category</th>
              <th className="p-2">Code</th>
              <th className="p-2">Description</th>
              <th className="p-2">Unit</th>
              <th className="p-2">Rate</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.item_id} className="border-b">
                <td className="p-2">{it.category?.name ?? "—"}</td>
                <td className="p-2">{it.item_code}</td>
                <td className="p-2">{it.item_description}</td>
                <td className="p-2">{it.unit}</td>
                <td className="p-2">{it.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
