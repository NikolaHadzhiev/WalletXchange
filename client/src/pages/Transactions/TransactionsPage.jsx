import { useState, useEffect, useCallback } from "react";
import PageTitle from "../../components/PageTitle";
import { Table, message } from "antd";
import { TransferMoneyModal } from "./TransferMoneyModal";
import { ReloadUser } from "../../state/userSlice";
import { HideLoading, ShowLoading } from "../../state/loaderSlice";
import { useDispatch, useSelector } from "react-redux";
import { GetTransactionsOfUser } from "../../api/transactions";
import moment from "moment";
import DepositModal from "./DepositModal";

function Transactions() {
  const [showTransferMoneyModal, setShowTransferMoneyModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [data, setData] = useState([]);
  const { user } = useSelector((state) => state.users);
  const dispatch = useDispatch();

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

      <Table
        columns={columns}
        dataSource={data.map((obj, index) => {
          return { ...obj, key: index };
        })}
        className="mt-2"
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
