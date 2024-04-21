import { useState } from "react";
import PageTitle from "../../components/PageTitle";
import { Table } from "antd";
import { TransferMoneyModal } from "./TransferMoneyModal";

function Transactions() {
  const [showTransferMoneyModal, setShowTransferMoneyModal] = useState(false);

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
    },
    {
      title: "Transaction ID",
      dataIndex: "_id",
    },
    {
      title: "Amount",
      dataIndex: "amount",
    },
    {
      title: "Type",
      dataIndex: "type",
    },
    {
      title: "Reference",
      dataIndex: "reference",
    },
    {
      title: "Status",
      dataIndex: "status",
    },
  ];

  return (
    <>
      <div className="flex justify-between items-center">
        <PageTitle title="Transactions" />

        <div className="flex gap-1">
          <button className="primary-outlined-btn">Deposit</button>
          <button
            className="primary-contained-btn"
            onClick={() => setShowTransferMoneyModal(true)}
          >
            Transfer
          </button>
        </div>
      </div>

      <Table columns={columns} dataSource={[]} className="mt-2" />

      {showTransferMoneyModal && (
        <TransferMoneyModal
          showTransferMoneyModal={showTransferMoneyModal}
          setShowTransferMoneyModal={setShowTransferMoneyModal}
        />
      )}
    </>
  );
}

export default Transactions;
