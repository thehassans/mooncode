import React from 'react'
import OrderListBase from './OrderListBase.jsx'

export default function DriverPicked(){
  return (
    <OrderListBase
      title="Picked Up"
      subtitle="Orders you have marked as picked up"
      endpoint="/api/orders/driver/picked"
      showDeliverCancel
    />
  )
}
