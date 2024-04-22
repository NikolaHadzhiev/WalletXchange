import { useState } from "react";
import { InputNumber, Modal, Form, Input, message } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { TransferMoney, VerifyAccount } from "../../api/transactions";
import { ShowLoading, HideLoading } from "../../state/loaderSlice";
import { ReloadUser } from "../../state/userSlice";

export const TransferMoneyModal = ({
  showTransferMoneyModal,
  setShowTransferMoneyModal,
  reloadData
}) => {
  const { TextArea } = Input;
  const [form] = Form.useForm();
  const dispatch = useDispatch();

  const [isVerified, setIsVerified] = useState("");
  const { user } = useSelector((state) => state.users);

  const verifyAccount = async () => {
    try {
      dispatch(ShowLoading());

      const response = await VerifyAccount({
        sender: user._id,
        receiver: form.getFieldValue("receiver"),
      });

      dispatch(HideLoading());

      if (response.success) {

        reloadData();
        message.success(response.message);
        setIsVerified("yes");
        dispatch(ReloadUser(true));

      } else {
        message.error(response.message);
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
        reference : values.reference || "no description",
        sender: user._id,
        status: "success",
      };

      const response = await TransferMoney(payload);
      
      if (response.success) {

        reloadData();
        setShowTransferMoneyModal(false);
        message.success(response.message);
        //dispatch(ReloadUser(true))

      }else{
        message.error(response.message);
      }

      dispatch(HideLoading());
      
    } 
    catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
    }
  }

  return (
    <>
      <Modal
        title="Transfer Money"
        open={showTransferMoneyModal}
        onClose={() => setShowTransferMoneyModal(false)}
        onCancel={() => setShowTransferMoneyModal(false)}
        footer={null}
        styles={"title"}
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
            <div className="success-bg">Account Verified Successfully</div>
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
              }
            ]}
          >
            <InputNumber min={1} max={Number(user.balance)} step={0.01} controls={false} />
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
    </>
  );
};
