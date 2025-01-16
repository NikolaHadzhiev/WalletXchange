import { Modal, Form, InputNumber, message } from "antd";
import StripeCheckout from "react-stripe-checkout";
import { DepositMoney } from "../../api/transactions";
import { useDispatch } from "react-redux";
import { HideLoading, ShowLoading } from "../../state/loaderSlice";
import DOMPurify from "dompurify"; // For sanitizing data

function DepositModal({ showDepositModal, setShowDepositModal, reloadData }) {
  const [form] = Form.useForm();
  const dispatch = useDispatch();

  const onToken = async (token) => {
    try {
      // Validate the amount before proceeding
      const amount = form.getFieldValue("amount");
      if (!amount || amount <= 0) {
        message.error("Please enter a valid amount.");
        return;
      }

      dispatch(ShowLoading());

      const response = await DepositMoney({
        token,
        amount,
      });

      dispatch(HideLoading());

      // Sanitize response message to prevent XSS
      const sanitizedMessage = DOMPurify.sanitize(response.message);

      if (response.success) {
        reloadData();
        setShowDepositModal(false);
        message.success(sanitizedMessage);
      } else {
        message.error(sanitizedMessage);
      }
    } catch (error) {
      dispatch(HideLoading());
      
      // Sanitize error message to avoid exposing sensitive info
      const sanitizedErrorMessage = DOMPurify.sanitize(error.message);
      message.error(sanitizedErrorMessage);
    }
  };

  return (
    <Modal
      title="Deposit"
      open={showDepositModal}
      onCancel={() => setShowDepositModal(false)}
      footer={null}
    >
      <div className="flex-col gap-1">
        <Form layout="vertical" form={form}>
          <Form.Item
            label="Amount"
            name="amount"
            rules={[
              {
                required: true,
                message: "Please input amount",
              },
            ]}
          >
            <InputNumber min={1} controls={false} />
          </Form.Item>

          <div className="flex justify-end gap-1">
            <button
              className="primary-outlined-btn"
              onClick={() => setShowDepositModal(false)}
            >
              Cancel
            </button>
            <StripeCheckout
              token={onToken}
              currency="USD"
              amount={form.getFieldValue("amount") * 100} // Convert to cents for Stripe
              shippingAddress
              stripeKey="pk_test_51P8KILJu27FG0r8818B58hMz1ejeheU6F84tFUXtmcvkRgc4ofbw2zEejUwPTTE38LoqB4GZZBiCVCieIBjkRTXW00fqLAGsNI"
            >
              <button className="primary-contained-btn">Deposit</button>
            </StripeCheckout>
          </div>
        </Form>
      </div>
    </Modal>
  );
}

export default DepositModal;
