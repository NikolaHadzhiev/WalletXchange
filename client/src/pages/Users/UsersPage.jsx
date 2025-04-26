import { Modal, message, Table } from "antd";
import { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  DeleteUser,
  GetAllUsers,
  RequestUserDelete,
  UpdateUserVerifiedStatus,
  EditUser
} from "../../api/users";
import { Form, Input } from "antd";
import DOMPurify from "dompurify";
import { HideLoading, ShowLoading } from "../../state/loaderSlice";
import PageTitle from "../../components/PageTitle";
import { LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { AdminDisable2FA } from "../../api/users";

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
              <button
                className="primary-outlined-btn"
                onClick={() => openEditModal(record)}
              >
                Edit
              </button>
              <div className="flex gap-1 justify-center">
                <button
                  className="primary-outlined-btn red"
                  onClick={() => 
                      Modal.confirm({
                        title: "Delete User",
                        content: "Are you sure you want to delete user?",
                        okText: "Yes",
                        cancelText: "No",
                        onOk: () => {
                          deleteUser(record)
                          message.success("User deletion was successfull.");
                        }
                    })
                  }
                >
                  Delete
                </button>
                {record.requestDelete && (
                  <button
                    className="primary-outlined-btn"
                    onClick={() => 
                      Modal.confirm({
                        title: "Cancel User Deletion",
                        content: "Are you sure you want to cancel user deletion?",
                        okText: "Yes",
                        cancelText: "No",
                        onOk: () => {
                          cancelDelete(record)
                          message.info("User deletion was cancelled.");
                        }
                    })
                  }
                  >
                    Cancel deletion
                  </button>
                )}
              </div>
            </div>
          )
        );
      },
    },
  ];

  useEffect(() => {
    getData();
  }, [getData]);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();
  const [passwordLocked, setPasswordLocked] = useState(true);
  const [disable2FALocked, setDisable2FALocked] = useState(true);

  const openEditModal = (record) => {
    setEditingUser(record);
    setEditModalVisible(true);
    setPasswordLocked(true); // Always lock password field initially
    setDisable2FALocked(true); // Always lock 2FA disable button initially
    form.setFieldsValue(record);
    form.setFieldValue('password', '');
  };

  const handleEditUser = async () => {
    try {
      const values = form.getFieldsValue();
      // Sanitize all fields
      const sanitized = {};
      Object.keys(values).forEach((key) => {
        sanitized[key] = DOMPurify.sanitize(values[key]);
      });
      sanitized._id = editingUser._id;
      sanitized.password = passwordLocked ? undefined : sanitized.password;
      dispatch(ShowLoading());
      const response = await EditUser(sanitized);
      dispatch(HideLoading());
      if (response.success) {
        message.success(response.message);
        setEditModalVisible(false);
        getData();
      } else {
        message.error(response.message);
      }
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
    }
  };

  return (
    <>
      <PageTitle title="Users" />
      <Table columns={colums} dataSource={users} className="mt-2" />
      <Modal
        title="Edit User"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEditUser}
        okText="Save"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="firstName" label="First Name" rules={[{ required: true, message: "First name is required" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="lastName" label="Last Name" rules={[{ required: true, message: "Last name is required" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: "email", message: "Valid email is required" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phoneNumber" label="Phone Number" rules={[{ required: true, message: "Phone number is required" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Address" rules={[{ required: true, message: "Address is required" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="identificationType" label="Identification Type" rules={[{ required: true, message: "Identification type is required" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="identificationNumber" label="Identification Number" rules={[{ required: true, message: "Identification number is required" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label={
              <span>
                Password
                <span
                  style={{ marginLeft: 8, cursor: 'pointer' }}
                  onClick={() => setPasswordLocked((prev) => !prev)}
                  title={passwordLocked ? 'Unlock to edit password' : 'Lock password field'}
                >
                  {passwordLocked ? <LockOutlined /> : <UnlockOutlined />}
                </span>
              </span>
            }
            rules={[
              { min: 8, message: "Password must be at least 8 characters" },
              { pattern: /^(|(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,})$/, message: "Password must include letters and numbers" }
            ]}
          >
            <Input.Password
              autoComplete="new-password"
              placeholder="Leave blank to keep current password"
              disabled={passwordLocked}
            />
          </Form.Item>
          <Form.Item>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="primary-outlined-btn"
                style={{ width: '100%' }}
                onClick={async () => {
                  if (!editingUser) return;
                  dispatch(ShowLoading());
                  const response = await AdminDisable2FA({ editUserId: editingUser._id });
                  dispatch(HideLoading());
                  if (response.success) {
                    message.success('2FA disabled for user.');
                    setEditModalVisible(false);
                    getData();
                  } else {
                    message.error(response.message || 'Failed to disable 2FA.');
                  }
                }}
                disabled={disable2FALocked || !editingUser?.twoFactorEnabled}
              >
                Disable 2FA for this user
              </button>
              <span
                style={{ cursor: 'pointer' }}
                onClick={() => setDisable2FALocked((prev) => !prev)}
                title={disable2FALocked ? 'Unlock to allow disabling 2FA' : 'Lock 2FA disable button'}
              >
                {disable2FALocked ? <LockOutlined /> : <UnlockOutlined />}
              </span>
            </span>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default Users;
