import { useState } from "react";
import { InputNumber, Modal, Form, Input, message } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { TransferMoney, VerifyAccount } from "../../api/transactions";
import { ShowLoading, HideLoading } from "../../state/loaderSlice";
import { ReloadUser } from "../../state/userSlice";
import DOMPurify from "dompurify"; // For sanitizing data

export const TransferMoneyModal = ({
  showTransferMoneyModal,
  setShowTransferMoneyModal,
  reloadData
}) => {
  const { TextArea } = Input;
  const [form] = Form.useForm();
  const dispatch = useDispatch();

  const [isVerified, setIsVerified] = useState("");
  const [isReceiverValid, setIsReceiverValid] = useState(false); // State to track receiver validity
  const { user } = useSelector((state) => state.users);
  const maxBalance = Number(user?.balance) > 0 ? Number(user.balance) : 1;
  
  // Validate receiver input
  const handleReceiverChange = (e) => {
    const receiverAccount = e.target.value;
    // Regular expression to ensure no special characters are present
    const isValid = /^[a-zA-Z0-9]+$/.test(receiverAccount) && receiverAccount.trim() !== "";
    setIsReceiverValid(isValid);
  };

  const verifyAccount = async () => {
    try {
      dispatch(ShowLoading());

      const receiverAccount = form.getFieldValue("receiver");

      // Basic validation for receiver account
      if (!receiverAccount || receiverAccount.trim() === "") {
        message.error("Please enter a valid account number.");
        dispatch(HideLoading());
        return;
      }

      const response = await VerifyAccount({
        sender: user._id,
        receiver: receiverAccount,
      });

      dispatch(HideLoading());

      if (response.success) {
        message.success(response.message);
        setIsVerified("yes");
      } else {
        message.error(response.message);
        setIsVerified("no");
      }
    } catch (error) {
      dispatch(HideLoading());
      setIsVerified("no");
      message.error("Error verifying account. Please try again.");
    }
  };

  const onFinish = async (values) => {
    try {
      // Sanitize the description (reference) before submitting
      const sanitizedReference = DOMPurify.sanitize(values.reference || "no description");

      // Validate the transfer amount
      const amount = values.amount;
      if (amount <= 0 || amount > Number(user.balance)) {
        message.error("Invalid amount. Ensure it is within your balance.");
        return;
      }

      dispatch(ShowLoading());

      const payload = {
        ...values,
        reference: sanitizedReference,
        sender: user._id,
        status: "success",
      };

      const response = await TransferMoney(payload);

      if (response.success) {
        reloadData();
        setShowTransferMoneyModal(false);
        message.success(response.message);
        dispatch(ReloadUser(true));
      } else {
        message.error(response.message);
      }

      dispatch(HideLoading());
    } catch (error) {
      dispatch(HideLoading());
      message.error("An error occurred. Please try again.");
    }
  };

  return (
    <Modal
      title="Transfer Money"
      open={showTransferMoneyModal}
      onClose={() => setShowTransferMoneyModal(false)}
      onCancel={() => setShowTransferMoneyModal(false)}
      footer={null}
    >
      <Form layout="vertical" form={form} onFinish={onFinish}>
        <div className="flex gap-2 items-center">
          <Form.Item
            label="Account Number"
            name="receiver"
            className="w-100"
            rules={[
              {
                required: true,
                message: "Please input your receiver!",
              },
              {
                pattern: /^[a-zA-Z0-9]*$/, // Validate no special characters
                message: "Forbidden characters.",
              },
            ]}
          >
            <Input onChange={handleReceiverChange} />
          </Form.Item>
          <button
            className={`primary-contained-btn mt-1 ${!isReceiverValid ? "grayed-out" : ""}`}
            type="button"
            onClick={verifyAccount}
            disabled={!isReceiverValid} // Disable button if receiver input is invalid
          >
            VERIFY
          </button>
        </div>

        {isVerified === "yes" && (
          <div className="success-bg">Account Verified Successfully</div>
        )}

        {isVerified === "no" && <div className="error-bg">Invalid Account</div>}

        <Form.Item
          label="Amount"
          name="amount"
          rules={[
            {
              required: true,
              message: "Please input the amount",
            },
          ]}
        >
          <InputNumber
            min={1}
            max={maxBalance}
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
            onClick={() => setShowTransferMoneyModal(false)}
          >
            Cancel
          </button>
          {isVerified === "yes" && (
            <button className="primary-contained-btn" type="submit">
              Transfer
            </button>
          )}
        </div>
      </Form>
    </Modal>
  );
};
