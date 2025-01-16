import { useState, useCallback, useEffect } from "react";
import moment from "moment";
import { message, Tabs, Table } from "antd";
import PageTitle from "../../components/PageTitle";
import RequestModal from "./RequestModal";
import { GetAllRequestsByUser, UpdateRequestStatus } from "../../api/requests";
import { useDispatch, useSelector } from "react-redux";
import { HideLoading, ShowLoading } from "../../state/loaderSlice";
import { ReloadUser } from "../../state/userSlice";

const { TabPane } = Tabs;

function Requests() {
  const [data, setData] = useState([]);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const { user } = useSelector((state) => state.users);
  const dispatch = useDispatch();

  const getData = useCallback(async () => {
    try {
      dispatch(ShowLoading());

      const response = await GetAllRequestsByUser();

      if (response.success) {
        const sendData = response.data.filter(
          (item) => item.sender._id === user._id
        );

        const receivedData = response.data.filter(
          (item) => item.receiver._id === user._id
        );

        setData({
          sent: sendData.map((obj, index) => {
            return { ...obj, key: index };
          }),
          received: receivedData.map((obj, index) => {
            return { ...obj, key: index };
          }),
        });
      }

      dispatch(ReloadUser(true));
      dispatch(HideLoading());
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
    }
  }, [dispatch, user._id]);

  const updateStatus = async (record, status) => {
    try {
      if (status === "accepted" && record.amount > user.balance) {
        message.error("Insufficient funds");
        return;
      } else {
        dispatch(ShowLoading());

        const response = await UpdateRequestStatus({
          ...record,
          status,
        });

        dispatch(HideLoading());

        if (response.success) {

          getData();
          message.success(response.message);
          dispatch(ReloadUser(true));

        } else {
          message.error(response.message);
        }
      }
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
    }
  };

  const columns = [
    {
      key: "request_id",
      title: "Request ID",
      dataIndex: "_id",
    },
    {
      key: "sender_id",
      title: "Sender",
      dataIndex: "sender",
      render(sender) {
        return sender.firstName + " " + sender.lastName;
      },
    },
    {
      key: "reciever_id",
      title: "Receiver",
      dataIndex: "receiver",
      render(receiver) {
        return receiver.firstName + " " + receiver.lastName;
      },
    },
    {
      key: "amount",
      title: "Amount",
      dataIndex: "amount",
    },
    {
      key: "date",
      title: "Date",
      dataIndex: "date",
      render(text, record) {
        return moment(record.createdAt).format("DD-MM-YYYY hh:mm:ss A");
      },
    },
    {
      key: "status",
      title: "Status",
      dataIndex: "status",
    },
    {
      key: "action",
      title: "Action",
      dataIndex: "action",
      render: (text, record) => {
        if (record.status === "pending" && record.receiver._id === user._id) {
          return (
            <div className="flex gap-1">
              <h1
                className="text-sm underline"
                onClick={() => updateStatus(record, "rejected")}
              >
                Reject
              </h1>
              <h1
                className="text-sm underline"
                onClick={() => updateStatus(record, "accepted")}
              >
                Accept
              </h1>
            </div>
          );
        }
      },
    },
  ];

  useEffect(() => {
    getData();
  }, [getData]);

  return (
    <>
      <div className="flex justify-between">
        <PageTitle title="Requests" />
        <button
          className="primary-outlined-btn"
          onClick={() => setShowNewRequestModal(true)}
        >
          Request Money
        </button>
      </div>

      <Tabs defaultActiveKey="1">
        <TabPane tab="Sent" key="1">
          <Table columns={columns} dataSource={data.sent} />
        </TabPane>
        <TabPane tab="Received" key="2">
          <Table columns={columns} dataSource={data.received} />
        </TabPane>
      </Tabs>

      {showNewRequestModal && (
        <RequestModal
          showNewRequestModal={showNewRequestModal}
          setShowNewRequestModal={setShowNewRequestModal}
          reloadData={getData}
        />
      )}
    </>
  );
}

export default Requests;
