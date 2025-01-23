import { message, Table } from "antd";
import { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  DeleteUser,
  GetAllUsers,
  RequestUserDelete,
  UpdateUserVerifiedStatus,
} from "../../api/users";
import { HideLoading, ShowLoading } from "../../state/loaderSlice";
import PageTitle from "../../components/PageTitle";

function Users() {
  const [users, setUsers] = useState([]);
  const { user } = useSelector((state) => state.users);

  const dispatch = useDispatch();

  const getData = useCallback(async () => {
    try {
      dispatch(ShowLoading());

      const response = await GetAllUsers();

      dispatch(HideLoading());

      if (response.success) {
        setUsers(
          response.data.map((obj, index) => {
            return { ...obj, key: index };
          })
        );

        message.success(response.message);
      } else {
        message.error(response.message);
      }
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
    }
  }, [dispatch]);

  const updateStatus = async (record, isVerified) => {
    try {
      dispatch(ShowLoading());

      const response = await UpdateUserVerifiedStatus({
        selectedUser: record._id,
        isVerified,
      });

      dispatch(HideLoading());

      if (response.success) {
        message.success(response.message);
        getData();
      } else {
        message.error(response.message);
      }
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
    }
  };

  const deleteUser = async (record) => {
    try {
      dispatch(ShowLoading());

      const response = await DeleteUser({
        _id: record._id
      });

      dispatch(HideLoading());

      if (response.success) {
        message.success(response.message);
        getData();
      } else {
        message.error(response.message);
      }
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
    }
  };

  const cancelDelete = async (record) => {
    try {
      dispatch(ShowLoading());

      const response = await RequestUserDelete({
        _id: record._id,
        requestDelete: false,
      });

      dispatch(HideLoading());

      if (response.success) {
        message.success(response.message);
        getData();
      } else {
        message.error(response.message);
      }
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
    }
  };

  const colums = [
    {
      key: "first_name",
      title: "First Name",
      dataIndex: "firstName",
    },
    {
      key: "last_name",
      title: "Last Name",
      dataIndex: "lastName",
    },
    {
      key: "email",
      title: "Email",
      dataIndex: "email",
    },
    {
      key: "phone",
      title: "Phone",
      dataIndex: "phoneNumber",
    },
    {
      key: "verified",
      title: "Verified",
      dataIndex: "isVerified",
      render: (text) => {
        return text ? "Yes" : "No";
      },
    },
    {
      key: "action",
      title: "Actions",
      dataIndex: "actions",
      render: (text, record) => {
        return (
          record._id !== user._id && (
            <div className="flex gap-1 justify-center">
              {record.isVerified ? (
                <button
                  className="primary-outlined-btn"
                  onClick={() => updateStatus(record, false)}
                >
                  Suspend
                </button>
              ) : (
                <button
                  className="primary-outlined-btn"
                  onClick={() => updateStatus(record, true)}
                >
                  Activate
                </button>
              )}

              {record.requestDelete && (
                <div className="flex gap-1 justify-center">
                  <button
                    className="primary-outlined-btn red"
                    onClick={() => deleteUser(record)}
                  >
                    Delete
                  </button>
                  <button
                    className="primary-outlined-btn"
                    onClick={() => cancelDelete(record)}
                  >
                    Cancel deletion
                  </button>
                </div>
              )}
            </div>
          )
        );
      },
    },
  ];

  useEffect(() => {
    getData();
  }, [getData]);

  return (
    <>
      <PageTitle title="Users" />
      <Table columns={colums} dataSource={users} className="mt-2" />
    </>
  );
}

export default Users;
