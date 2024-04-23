import { useState } from "react";
import { Modal, Form, message, Input, InputNumber } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { VerifyAccount } from "../../api/transactions";
import { ShowLoading, HideLoading } from "../../state/loaderSlice";
import { SendRequest } from "../../api/requests";

function RequestModal({
  showNewRequestModal,
  setShowNewRequestModal,
  reloadData,
}) {
  const { TextArea } = Input;
  const [form] = Form.useForm();
  const dispatch = useDispatch();

  const { user } = useSelector((state) => state.users);
  const [isVerified, setIsVerified] = useState("");

  const verifyAccount = async () => {
    try {
      dispatch(ShowLoading());

      const response = await VerifyAccount({
        receiver: form.getFieldValue("receiver"),
      });

      dispatch(HideLoading());

      if (response.success) {
        setIsVerified("yes");
      } else {
        setIsVerified("no");
      }
    } catch (error) {
      dispatch(HideLoading());
      setIsVerified("no");
    }
  };

  const onFinish = async (values) => {
    try {
      dispatch(ShowLoading());

      const payload = {
        ...values,
        sender: user._id,
        status: "success",
        reference: values.reference || "no description",
      };

      const response = await SendRequest(payload);

      if (response.success) {
        reloadData();
        setShowNewRequestModal(false);
        message.success(response.message);
      } else {

        setShowNewRequestModal(false);
        message.error(response.message);
        
      }

      dispatch(HideLoading());
    } catch (error) {
      message.error(error.message);
      dispatch(HideLoading());
    }
  };

  return (
    <div>
      <Modal
        title="Request Money"
        open={showNewRequestModal}
        onCancel={() => setShowNewRequestModal(false)}
        onClose={() => setShowNewRequestModal(false)}
        footer={null}
      >
        <Form layout="vertical" form={form} onFinish={onFinish}>
          <div className="flex gap-2 items-center">
            <Form.Item label="Account Number" name="receiver" className="w-100">
              <Input />
            </Form.Item>
            <button
              className="primary-contained-btn mt-1"
              type="button"
              onClick={verifyAccount}
            >
              VERIFY
            </button>
          </div>

          {isVerified === "yes" && (
            <div className="success-bg">Account verified successfully</div>
          )}

          {isVerified === "no" && (
            <div className="error-bg">Invalid Account</div>
          )}

          <Form.Item
            label="Amount"
            name="amount"
            rules={[
              {
                required: true,
                message: "Please input your amount!",
              },
            ]}
          >
            <InputNumber
              min={1}
              step={0.01}
              controls={false}
            />
          </Form.Item>

          <Form.Item label="Description" name="reference">
            <TextArea rows={4} />
          </Form.Item>

          <div className="flex justify-end gap-1">
            <button
              className="primary-outlined-btn"
              onClick={() => setShowNewRequestModal(false)}
            >
              Cancel
            </button>
            {isVerified === "yes" && (
              <button className="primary-contained-btn" type="submit">
                Request
              </button>
            )}
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default RequestModal;
