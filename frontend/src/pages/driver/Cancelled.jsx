import React from 'react'
import OrderListBase from './OrderListBase.jsx'

export default function DriverCancelled(){
  return (
    <OrderListBase
      title="Cancelled Orders"
      subtitle="Orders cancelled by you or the customer"
      endpoint="/api/orders/driver/cancelled"
      withFilters
    />
  )
}
