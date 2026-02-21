import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listAllSpecialItemRequests, approveSpecialItemRequest, rejectSpecialItemRequest } from "../../api/estimations";
import { FaCheck, FaTimes, FaSpinner, FaDownload } from "react-icons/fa";

export default function NotificationsPage() {
  const { user, hasRole } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null); // 'approve' | 'reject'
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await listAllSpecialItemRequests('pending');
      setRequests(res || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleOpenApproveModal = (req) => {
    setSelectedRequest(req);
    setModalType('approve');
    setIsModalOpen(true);
  };

  const handleOpenRejectModal = (req) => {
    setSelectedRequest(req);
    setModalType('reject');
    setRejectionReason("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRequest(null);
    setModalType(null);
    setRejectionReason("");
  };

  const handleSubmitAction = async () => {
    if (!selectedRequest) return;
    const id = selectedRequest.request_id;
    
    try {
      setProcessingId(id);
      if (modalType === 'approve') {
        await approveSpecialItemRequest(id);
        setRequests(prev => prev.filter(r => r.request_id !== id));
      } else if (modalType === 'reject') {
        await rejectSpecialItemRequest(id, rejectionReason || "No reason provided");
        setRequests(prev => prev.filter(r => r.request_id !== id));
      }
      handleCloseModal();
    } catch (err) {
      alert(`Failed to ${modalType} request: ` + (err.response?.data?.detail || err.message));
    } finally {
      setProcessingId(null);
    }
  };

  const downloadAttachment = (req) => {
    if (!req.attachment_base64) return;
    try {
      const a = document.createElement('a');
      a.href = `data:application/octet-stream;base64,${req.attachment_base64}`;
      a.download = req.attachment_name || `attachment_${req.request_id}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      alert('Failed to download attachment.');
    }
  };

  if (!hasRole("admin") && !hasRole("superadmin")) {
    return <div className="p-8 text-center text-red-600">Access Denied</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Special Item Notifications</h1>
        <button onClick={fetchRequests} className="text-sm text-teal-600 hover:underline">Refresh</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><FaSpinner className="animate-spin text-teal-600 text-2xl" /></div>
      ) : error ? (
        <div className="text-red-600 bg-red-50 p-4 rounded">{error}</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">No pending requests found.</div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Division</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty / Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attachment</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map(req => (
                  <tr key={req.request_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(req.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">{req.requested_by?.username || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{req.organization}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {req.division?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      <div className="font-medium truncate" title={req.item_description}>{req.item_description}</div>
                      {req.sub_description && <div className="text-xs text-gray-500 truncate">{req.sub_description}</div>}
                      <div className="text-xs text-gray-400 mt-1">
                        Unit: {req.unit} 
                        {req.length && ` | L:${req.length}`}
                        {req.width && ` | W:${req.width}`}
                        {req.thickness && ` | T:${req.thickness}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>Qty: {req.quantity}</div>
                      <div>Rate: {req.rate}</div>
                      <div className="font-medium text-gray-900">Amt: {(req.quantity * req.rate).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {req.attachment_name ? (
                        <button onClick={() => downloadAttachment(req)} className="text-teal-600 hover:text-teal-800 flex items-center gap-1">
                          <FaDownload size={12} /> {req.attachment_name.slice(0, 15)}...
                        </button>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenApproveModal(req)}
                          disabled={processingId === req.request_id}
                          className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1 rounded-md flex items-center gap-1 disabled:opacity-50"
                        >
                          {processingId === req.request_id ? <FaSpinner className="animate-spin" /> : <FaCheck size={12} />}
                          Approve
                        </button>
                        <button
                          onClick={() => handleOpenRejectModal(req)}
                          disabled={processingId === req.request_id}
                          className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 rounded-md flex items-center gap-1 disabled:opacity-50"
                        >
                          {processingId === req.request_id ? <FaSpinner className="animate-spin" /> : <FaTimes size={12} />}
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              {modalType === 'approve' ? 'Approve Request' : 'Reject Request'}
            </h2>
            
            {modalType === 'approve' ? (
              <div className="mb-6">
                <p className="text-gray-700 mb-2">Are you sure you want to approve this request?</p>
                <div className="bg-gray-50 p-3 rounded text-sm text-gray-600 border border-gray-200">
                  <div className="font-semibold">{selectedRequest?.item_description}</div>
                  <div>Qty: {selectedRequest?.quantity} | Rate: {selectedRequest?.rate}</div>
                </div>
                <p className="text-xs text-gray-500 mt-2">This item will be added to the item master.</p>
              </div>
            ) : (
              <div className="mb-6">
                <p className="text-gray-700 mb-2">Please provide a reason for rejection:</p>
                <textarea
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  rows="3"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  autoFocus
                ></textarea>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium text-sm transition-colors"
                disabled={!!processingId}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAction}
                className={`px-4 py-2 text-white rounded-md flex items-center gap-2 font-medium text-sm transition-colors ${
                  modalType === 'approve' 
                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
                disabled={!!processingId}
              >
                {processingId ? <FaSpinner className="animate-spin" /> : (modalType === 'approve' ? <FaCheck /> : <FaTimes />)}
                {modalType === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
