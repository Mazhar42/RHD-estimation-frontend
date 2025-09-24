import { Link } from "react-router-dom";

export default function Sidebar({ setIsAddDivisionModalOpen, setIsAddItemModalOpen }) {
  return (
    <aside className="w-64 bg-teal-800 text-white min-h-screen p-4">
      <div className="text-xl font-bold mb-6">RHD Estimation App</div>
      <nav className="flex flex-col gap-2">
        <Link to="/products" className="px-3 py-2 rounded hover:bg-teal-700">Products</Link>
        <Link to="/projects" className="px-3 py-2 rounded hover:bg-teal-700">Projects</Link>
        <button onClick={() => setIsAddDivisionModalOpen(true)} className="px-3 py-2 rounded hover:bg-teal-700 text-left">Add Division</button>
        <button onClick={() => setIsAddItemModalOpen(true)} className="px-3 py-2 rounded hover:bg-teal-700 text-left">Add Item</button>
      </nav>
    </aside>
  );
}
