import { useState, useEffect } from "react";
import PageTitle from "../../components/PageTitle";
import { Table, message } from "antd";
import { TransferMoneyModal } from "./TransferMoneyModal";
import { HideLoading, ShowLoading } from "../../state/loaderSlice";
import { useDispatch, useSelector } from "react-redux";
import { GetTransactionsOfUser } from "../../api/transactions";
import moment from "moment";

function Transactions() {
  const [showTransferMoneyModal, setShowTransferMoneyModal] = useState(false);
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
        return record.sender._id === user._id ? "Sent" : "Recieved";
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

  useEffect(() => {
    const getData = async () => {
      try {
        dispatch(ShowLoading());

        const response = await GetTransactionsOfUser();

        if (response.success) {
          setData(response.data);
        }

        dispatch(HideLoading());
      } catch (error) {
        dispatch(HideLoading());
        message.error(error.message);
      }
    };

    getData();
  }, [dispatch]);

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
        />
      )}
    </>
  );
}

export default Transactions;
