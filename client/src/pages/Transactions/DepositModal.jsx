import { Modal, Form, InputNumber, message } from "antd";
import StripeCheckout from "react-stripe-checkout";
import { DepositMoney } from "../../api/transactions";
import { useDispatch } from "react-redux";
import { HideLoading, ShowLoading } from "../../state/loaderSlice";

function DepositModal({ showDepositModal, setShowDepositModal, reloadData}) {

  const [form] = Form.useForm();
  const dispatch = useDispatch();

  const onToken = async (token) => {

    console.log(token);

    try {

      dispatch(ShowLoading());

      const response = await DepositMoney({
        token,
        amount: form.getFieldValue("amount"),
      });

      dispatch(HideLoading());

      if (response.success) {
        
        reloadData();
        setShowDepositModal(false);
        message.success(response.message);

      } else {
        message.error(response.message);
      }
    } 
    catch (error) {

      dispatch(HideLoading());
      message.error(error.message);

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
              amount={form.getFieldValue("amount")}
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
