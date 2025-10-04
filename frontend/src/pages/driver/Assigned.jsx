import React from 'react'
import OrderListBase from './OrderListBase.jsx'

export default function DriverAssigned(){
  return (
    <OrderListBase
      title="Orders Assigned"
      subtitle="Orders currently assigned to you"
      endpoint="/api/orders/driver/assigned"
      showDeliverCancel
    />
  )
}
