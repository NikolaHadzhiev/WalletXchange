import { Modal, Form, InputNumber, Input } from "antd";
import { useSelector } from "react-redux";
import { useEffect } from "react";
import PaypalWithdrawalForm from "../../components/Deposit/PaypalWithdrawalForm";

function WithdrawalModal({ showWithdrawalModal, setShowWithdrawalModal, reloadData }) {
  const [form] = Form.useForm();
  const { user } = useSelector((state) => state.users);
  
  // Set the email value in the form when user data is available or when modal becomes visible
  useEffect(() => {
    if (user?.email && showWithdrawalModal) {
      form.setFieldsValue({ 
        paypalEmail: user.email 
      });
    }
  }, [user, showWithdrawalModal, form]);

  const handleSuccess = () => {
    reloadData();
    setShowWithdrawalModal(false);
  };

  return (
    <Modal
      title="Withdraw to PayPal"
      open={showWithdrawalModal}
      onCancel={() => setShowWithdrawalModal(false)}
      footer={null}
    >
      <div className="flex-col gap-1">
        <p className="mb-4">Current Balance: ${user?.balance?.toFixed(2)}</p>
        
        <Form layout="vertical" form={form}>
          <Form.Item
            label="Amount"
            name="amount"
            rules={[
              { required: true, message: "Please input amount" },
              () => ({
                validator(_, value) {
                  if (!value || value <= 0) {
                    return Promise.reject(new Error('Amount must be greater than 0'));
                  }
                  if (value > user?.balance) {
                    return Promise.reject(new Error('Amount cannot exceed your available balance'));
                  }
                  return Promise.resolve();
                }
              })
            ]}
          >
            <InputNumber min={1} max={user?.balance} controls={false} />
          </Form.Item>
          
          <Form.Item
            label="PayPal Email"
            name="paypalEmail"
            rules={[
              { required: true, message: "Please input your PayPal email" },
              { type: 'email', message: 'Please enter a valid email address' }
            ]}
          >              
            <Input />
          </Form.Item>

          <div className="flex justify-end gap-1">
            <button
              className="primary-outlined-btn"
              onClick={() => setShowWithdrawalModal(false)}
            >
              Cancel
            </button>
            
            <PaypalWithdrawalForm 
              form={form} 
              user={user}
              onSuccess={handleSuccess} 
            />
          </div>
        </Form>
      </div>
    </Modal>
  );
}

export default WithdrawalModal;
