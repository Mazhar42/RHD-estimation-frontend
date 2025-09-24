import React, { useState, useEffect } from 'react';

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const DataTable = ({ title, data = [], theme, totalRows, currentPage, itemsPerPage, onPageChange, onCellChange, columnSearches, onColumnSearch, fullHeight = false, allColumns = [] }) => {
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [localColumnSearches, setLocalColumnSearches] = useState(columnSearches);

  

  const debouncedColumnSearches = useDebounce(localColumnSearches, 500);

  const [isInitialMount, setIsInitialMount] = useState(true);

  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }

    onColumnSearch(debouncedColumnSearches);
  }, [debouncedColumnSearches, isInitialMount, onColumnSearch]);

  const columns = React.useMemo(() => {
    const colSet = new Set(allColumns);
    if (data && data.length > 0) {
      data.forEach(row => Object.keys(row).forEach(k => colSet.add(k)));
    }
    return Array.from(colSet);
  }, [allColumns, data]);

  const [showStats, setShowStats] = useState(false);
  const [selectedStatsCol, setSelectedStatsCol] = useState('');
  const [statsResult, setStatsResult] = useState(null);

  const numericColumns = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    return columns.filter(col => data.some(row => typeof row[col] === 'number' || (!isNaN(parseFloat(row[col])) && isFinite(row[col]))));
  }, [columns, data]);

  const dateColumns = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    return columns.filter(col =>
      data.some(row => {
        const v = row[col];
        if (typeof v !== 'string') return false;
        const parsed = Date.parse(v);
        return !isNaN(parsed) && isNaN(Number(v));
      })
    );
  }, [columns, data]);

  useEffect(() => {
    if (!selectedStatsCol) {
      setStatsResult(null);
      return;
    }
    const values = data
      .map(row => {
        const v = row[selectedStatsCol];
        if (typeof v === 'number') return v;
        const parsed = parseFloat(v);
        return isNaN(parsed) ? null : parsed;
      })
      .filter(v => v !== null && !isNaN(v));
    if (values.length === 0) {
      setStatsResult({ total: 0, average: 0 });
      return;
    }
    const total = values.reduce((a, b) => a + b, 0);
    const average = total / values.length;
    setStatsResult({ total, average });
  }, [selectedStatsCol, data]);

  const handleCellBlur = (e, rowIndex, colKey) => {
    const newValue = e.target.innerText;
    const oldValue = data[rowIndex][colKey];

    if (newValue !== String(oldValue)) {
      const occurrences = data.filter(row => String(row[colKey]) === String(oldValue)).length;
      setModalData({ rowIndex, colKey, oldValue, newValue, occurrences });
      setShowModal(true);
    }
  };

  const handleConfirm = (applyToAll) => {
    const { rowIndex, colKey, oldValue, newValue } = modalData;
    onCellChange(rowIndex, colKey, oldValue, newValue, applyToAll);
    setShowModal(false);
    setModalData(null);
  };

  const handleCancel = () => {
    setShowModal(false);
    setModalData(null);
  };

  const isDark = theme === 'dark';
  const totalPages = Math.ceil(totalRows / itemsPerPage);

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className={`bg-white p-2 sm:p-4 rounded-lg shadow-md ${fullHeight ? 'h-full flex flex-col' : 'mt-4'}`}>
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-0">{title}</h2>
      </div>
      <div className={`border rounded-lg flex flex-col ${isDark ? 'border-gray-700' : 'border-gray-200'}`}> 
        <div className="overflow-x-auto w-full">
          <div className="max-h-[60vh] overflow-auto">
            <table className="min-w-full border-collapse table-fixed">
              {columns.length >= 0 && (
                <thead className={`sticky top-0 z-10 ${isDark ? 'bg-gray-900' : 'bg-gray-100'} border-b-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}> 
                  <tr>
                    {columns.map((key) => (
                      <th key={key} scope="col" className={`px-2 py-1 text-left text-xs font-bold border-r min-w-[120px] sm:min-w-[150px] ${isDark ? 'text-white border-gray-700' : 'text-gray-800 border-gray-200'}`}> 
                        <div className="flex justify-between items-center">
                          <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {columns.map((key) => (
                      <th key={`search-${key}`} scope="col" className={`px-2 py-1 border-r min-w-[120px] sm:min-w-[150px] ${isDark ? 'border-gray-700' : 'border-gray-200'}`}> 
                        <input
                          type="text"
                          placeholder="Search..."
                          value={localColumnSearches[key] || ""}
                          onChange={(e) => setLocalColumnSearches({ ...localColumnSearches, [key]: e.target.value })}
                          className={`w-full text-xs px-2 py-1 border rounded-md transition-colors ${isDark ? 'bg-gray-600 text-white border-gray-600 placeholder-gray-400 focus:border-gray-400 focus:bg-gray-500' : 'bg-white text-gray-900 border-gray-300 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'}`}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody className={`divide-y ${isDark ? 'divide-gray-700 bg-gray-800' : 'divide-gray-200 bg-white'}`}> 
                {columns.length === 0 ? (
                  <tr>
                    <td className={`p-4 sm:p-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No data loaded yet</td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className={`p-4 sm:p-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      <div className="flex flex-col items-center">
                        <div className="text-lg mb-2">📭</div>
                        <div className="text-sm font-medium">No data found</div>
                        <div className="text-xs mt-1">Try adjusting your search criteria</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.map((row, i) => (
                    <tr key={i} className={`${i % 2 === 0 ? (isDark ? 'bg-gray-800' : 'bg-white') : (isDark ? 'bg-gray-750' : 'bg-gray-50')} hover:${isDark ? 'bg-gray-700' : 'bg-blue-50'} transition-colors`}>
                      {columns.map((key) => (
                        <td 
                          key={key} 
                          className={`px-2 py-1 whitespace-nowrap text-xs border-r min-w-[120px] sm:min-w-[150px] ${isDark ? 'text-gray-200 border-gray-600' : 'text-gray-800 border-gray-200'} ${(numericColumns.includes(key) || dateColumns.includes(key)) ? (isDark ? 'bg-gray-700 text-gray-400 italic' : 'bg-gray-100 text-gray-400 italic') : ''}`}
                          contentEditable={!(numericColumns.includes(key) || dateColumns.includes(key))}
                          onBlur={!(numericColumns.includes(key) || dateColumns.includes(key)) ? (e) => handleCellBlur(e, i, key) : undefined}
                          suppressContentEditableWarning={true}
                          style={{ cursor: (numericColumns.includes(key) || dateColumns.includes(key)) ? 'not-allowed' : 'text' }}
                        >
                          {String(row[key] ?? '')}
                          {(numericColumns.includes(key) || dateColumns.includes(key)) && (
                            <span className="ml-1 align-middle" title="Not editable">
                              <svg className="inline w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 12a6 6 0 11-12 0 6 6 0 0112 0zm-6 3v.01M12 9h.01" /></svg>
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <table className="min-w-full border-collapse table-fixed">
            <tfoot className={`${isDark ? 'bg-gray-800' : 'bg-white'} border-t-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <tr>
                <td colSpan={columns.length}>
                  <div className="px-2 sm:px-4 py-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                      <div className="flex items-center space-x-2 sm:space-x-4 mb-2 sm:mb-0">
                        <div className={`text-xs sm:text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}> 
                          <span className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'}`}> 
                            {(() => {
                              const start = (currentPage - 1) * itemsPerPage + 1;
                              let end = currentPage * itemsPerPage;
                              if (end > totalRows) end = totalRows;
                              if (totalRows === 0) return `0 of 0 items`;
                              return `${start}-${end} of ${totalRows} items`;
                            })()}
                          </span>
                        </div>
                        <div className="ml-4 flex items-center space-x-2">
                          <button
                            onClick={() => setShowStats(v => !v)}
                            className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white ${isDark ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'}`}
                          >
                            Get Stats
                          </button>
                          {showStats && (
                            <>
                              <select
                                className={`ml-2 px-2 py-1 rounded border text-xs ${isDark ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
                                value={selectedStatsCol}
                                onChange={e => setSelectedStatsCol(e.target.value)}
                              >
                                <option value="">Select column</option>
                                {numericColumns.map(col => (
                                  <option key={col} value={col}>{col}</option>
                                ))}
                              </select>
                              {selectedStatsCol && statsResult && (
                                <span className={
                                  `ml-3 inline-flex items-center px-3 py-1 rounded-lg shadow text-xs font-semibold border ${isDark ? 'bg-green-900 border-green-700 text-green-200' : 'bg-green-50 border-green-300 text-green-800'} transition-all duration-200`
                                }>
                                  <svg className={`w-4 h-4 mr-2 ${isDark ? 'text-green-300' : 'text-green-500'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 17a4 4 0 004-4V5a4 4 0 10-8 0v8a4 4 0 004 4zm0 0v2m0 0h2m-2 0H9" />
                                  </svg>
                                  <span className="mr-3">Sum: <span className="font-bold">{statsResult.total}</span></span>
                                  <span>Avg: <span className="font-bold">{statsResult.average}</span></span>
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      {totalRows > itemsPerPage && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 space-y-2 sm:space-y-0">
          <button
            onClick={handlePrevious}
            disabled={currentPage === 1}
            className="w-full sm:w-auto bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 disabled:bg-gray-400"
          >
            Previous
          </button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={handleNext}
            disabled={currentPage === totalPages}
            className="w-full sm:w-auto bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 disabled:bg-gray-400"
          >
            Next
          </button>
        </div>
      )}
      {showModal && modalData && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className={`bg-white ${isDark ? 'dark:bg-gray-900' : ''} rounded-lg shadow-2xl p-6 w-full max-w-sm sm:max-w-md transform transition-all`}>
            <div className="text-center">
              <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${isDark ? 'bg-blue-800' : 'bg-blue-100'}`}> 
                <svg className={`h-6 w-6 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <h3 className={`text-lg leading-6 font-medium ${isDark ? 'text-white' : 'text-gray-900'} mt-4`}>Confirm Change</h3>
              <div className={`mt-2 px-4 sm:px-7 py-3`}>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>There are {modalData.occurrences} items with the value &quot;{String(modalData.oldValue)}&quot;. Do you want to change them all to &quot;{String(modalData.newValue)}&quot;?</p>
              </div>
            </div>
            <div className="mt-5 sm:mt-6 space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
              <button
                onClick={() => handleConfirm(true)}
                className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:col-start-2 sm:text-sm ${isDark ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' : 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500'}`}
              >
                Apply to All ({modalData.occurrences})
              </button>
              <button
                onClick={() => handleConfirm(false)}
                className={`w-full inline-flex justify-center rounded-md border shadow-sm px-4 py-2 bg-white text-base font-medium sm:col-start-1 sm:text-sm ${isDark ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600 focus:ring-gray-500' : 'border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-indigo-500'}`}
              >
                Change Just This One
              </button>
            </div>
            <div className="mt-3 sm:mt-4">
              <button
                onClick={handleCancel}
                className="w-full inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;