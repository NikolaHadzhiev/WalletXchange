import { useState, useEffect, useCallback } from "react";
import PageTitle from "../../components/PageTitle";
import { Table, message, DatePicker, Button } from "antd";
import { TransferMoneyModal } from "./TransferMoneyModal";
import { ReloadUser } from "../../state/userSlice";
import { HideLoading, ShowLoading } from "../../state/loaderSlice";
import { useDispatch, useSelector } from "react-redux";
import { GetTransactionsOfUser } from "../../api/transactions";
import moment from "moment";
import DepositModal from "./DepositModal";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FileOutlined } from '@ant-design/icons';

function Transactions() {
  const [showTransferMoneyModal, setShowTransferMoneyModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [dateRange, setDateRange] = useState([null, null]);
  const { user } = useSelector((state) => state.users);
  const dispatch = useDispatch();
  const { RangePicker } = DatePicker;

  const columns = [
    {
      key: "date",
      title: "Date",
      dataIndex: "date",
      render: (text, record) => {
        return moment(record.createdAt).format("DD-MM-YYYY hh:mm:ss A");
      },
    },
    {
      key: "transaction_id",
      title: "Transaction ID",
      dataIndex: "_id",
    },
    {
      key: "amount",
      title: "Amount",
      dataIndex: "amount",
    },
    {
      key: "type",
      title: "Type",
      dataIndex: "type",
      render: (text, record) => {
        if (record.sender._id === record.receiver._id) {
          return "Deposit";
        } else if (record.sender._id === user._id) {
          return "Sent";
        } else return "Recieved";
      },
    },
    {
      key: "reference_account",
      title: "Reference Account",
      dataIndex: "",
      render: (text, record) => {
        return record.sender._id === user._id ? (
          <div>
            <h1 className="text-sm">
              {record.receiver._id} {record.receiver.firstName} {record.receiver.lastName}
            </h1>
          </div>
        ) : (
          <div>
            <h1 className="text-sm">
              {record.sender._id} {record.sender.firstName} {record.sender.lastName}
            </h1>
          </div>
        );
      },
    },
    {
      key: "description",
      title: "Description",
      dataIndex: "reference",
    },
    {
      key: "status",
      title: "Status",
      dataIndex: "status",
    },
  ];

  const getData = useCallback(async () => {
    try {
      dispatch(ShowLoading());
  
      const response = await GetTransactionsOfUser();
  
      if (response.success) {
        setData(response.data);
        setFilteredData(response.data);
      }
  
      dispatch(ReloadUser(true));
      dispatch(HideLoading());
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
      dispatch(ReloadUser(true))
    }
  }, [dispatch]);

  useEffect(() => {
    getData();
  }, [getData]);    
  
  const handleDateRangeChange = (dates) => {
    // Store the selected date range
    setDateRange(dates);
    
    // If dates array is null or dates are not selected, show all transactions
    if (!dates || dates.length === 0 || !dates[0] || !dates[1]) {
      setFilteredData(data);
      return;
    }
    
    try {
      // Get start and end dates directly from the moment objects provided by DatePicker
      // Use local date without timezone adjustments
      const startDate = dates[0].clone().startOf('day');
      const endDate = dates[1].clone().endOf('day');
      
      // Filter the transactions array that's already fetched
      const filtered = data.filter((item) => {
        if (!item.createdAt) {
          return false;
        }
        
        // Convert transaction date to raw ISO string first, then create a new moment
        // This avoids any timezone or parsing issues
        const rawDate = item.createdAt;
        
        // Directly compare month and year first (simplest approach)
        const txDate = moment(rawDate);
        const txMonth = txDate.month(); // 0-11
        const txYear = txDate.year();
        const txDay = txDate.date();
        
        const inStartMonth = startDate.month();
        const inStartYear = startDate.year();
        const inStartDay = startDate.date();
        
        const inEndMonth = endDate.month();
        const inEndYear = endDate.year();
        const inEndDay = endDate.date();
        
        // Simple manual date comparison logic
        const isInRange = (
          // Check if date is after or equal to start date
          (txYear > inStartYear || 
           (txYear === inStartYear && txMonth > inStartMonth) || 
           (txYear === inStartYear && txMonth === inStartMonth && txDay >= inStartDay)) &&
          // Check if date is before or equal to end date
          (txYear < inEndYear || 
           (txYear === inEndYear && txMonth < inEndMonth) || 
           (txYear === inEndYear && txMonth === inEndMonth && txDay <= inEndDay))
        );
        
        return isInRange;
      });
      
      setFilteredData(filtered);
    } catch (error) {
      console.error("Error filtering by date range:", error);
      message.error("Error filtering transactions by date");
      setFilteredData(data); // Fallback to showing all
    }
  };
  
  const exportToPDF = () => {
    const doc = new jsPDF('landscape'); // Use landscape orientation for wider tables
    doc.text("WalletXChange Transactions Report", 14, 16);
    
    // Add metadata information
    doc.setFontSize(10);
    doc.text(`Generated: ${moment().format('DD-MM-YYYY hh:mm:ss A')}`, 14, 22);
    doc.text(`User: ${user.firstName} ${user.lastName}`, 14, 26);
    
    // Add date range information if available
    let startY = 30;
    if (dateRange && dateRange[0] && dateRange[1]) {
      doc.text(`Date Range: ${dateRange[0].format('DD-MM-YYYY')} to ${dateRange[1].format('DD-MM-YYYY')}`, 14, startY);
      startY += 4;
    }    
    
    autoTable(doc, {
      startY: startY,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      bodyStyles: { textColor: 50 },
      margin: { horizontal: 'auto' },
      tableWidth: 'auto',
      styles: { 
        overflow: 'linebreak', 
        cellWidth: 'wrap', 
        fontSize: 9,
        halign: 'center',
        valign: 'middle'
      },
      columnStyles: { 
        0: { cellWidth: 35 }, // Date
        1: { cellWidth: 45 }, // Transaction ID
        2: { cellWidth: 20 }, // Amount
        3: { cellWidth: 20 }, // Type
        4: { cellWidth: 55 }, // Reference Account
        5: { cellWidth: 35 }, // Description
        6: { cellWidth: 20 }  // Status
      },
      head: [
        [
          "Date",
          "Transaction ID",
          "Amount",
          "Type",
          "Reference Account",
          "Description",
          "Status",
        ],
      ],
      body: filteredData.map((item) => [
        moment(item.createdAt).format("DD-MM-YYYY hh:mm:ss A"),
        item._id,
        item.amount,
        item.sender._id === item.receiver._id 
          ? "Deposit"
          : item.sender._id === user._id 
            ? "Sent" 
            : "Received",
        item.sender._id === user._id
          ? `${item.receiver._id} ${item.receiver.firstName} ${item.receiver.lastName}`
          : `${item.sender._id} ${item.sender.firstName} ${item.sender.lastName}`,
        item.reference,
        item.status,
      ]),
    });
    doc.save("walletXChange-transactions.pdf");
  };

  return (
    <>
      <div className="flex justify-between items-center">
        <PageTitle title="Transactions" />

        <div className="flex gap-1">
          <button
            className="primary-outlined-btn"
            onClick={() => setShowDepositModal(true)}
          >
            Deposit
          </button>

          <button
            className="primary-contained-btn"
            onClick={() => setShowTransferMoneyModal(true)}
          >
            Transfer
          </button>
        </div>
      </div>
        <div className="flex justify-between items-center mt-2">      
        <div className="flex items-center">
          <span className="mr-1">Filter by date:</span>
          <RangePicker 
            onChange={handleDateRangeChange}
            format="DD-MM-YYYY"
            placeholder={['Start Date', 'End Date']}
            allowClear={true}
            value={dateRange}
          />
          {dateRange && dateRange[0] && dateRange[1] && (
            <Button
              type="link"
              onClick={() => {
                setDateRange([null, null]);
                setFilteredData(data);
              }}
              className="ml-2"
            >
              Clear Filter
            </Button>
          )}
        </div>
      </div>      
      <Table
        columns={columns}
        dataSource={filteredData.map((obj, index) => {
          return { ...obj, key: index };
        })}
        className="mt-2"
        pagination={{
          showTotal: (total, range) => (
            <div className="flex items-center">
              <div className="mr-1">
                <Button 
                  className="primary"
                  type="primary"
                  style={{ background: "var(--primary)"}}
                  icon={<FileOutlined />}
                  onClick={exportToPDF}
                  size="small"
                >
                  Export to PDF
                </Button>
              </div>
              <span>{`${range[0]}-${range[1]} of ${total} items`}</span>
            </div>
          ),
        }}
      />

      {showTransferMoneyModal && (
        <TransferMoneyModal
          showTransferMoneyModal={showTransferMoneyModal}
          setShowTransferMoneyModal={setShowTransferMoneyModal}
          reloadData={getData}
        />
      )}

      {showDepositModal && (
        <DepositModal
          showDepositModal={showDepositModal}
          setShowDepositModal={setShowDepositModal}
          reloadData={getData}
        />
      )}
    </>
  );
}

export default Transactions;
