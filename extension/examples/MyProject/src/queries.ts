import { AppDataSource } from "./data-source";
import { Order } from "./entity/User";

async function getOrdersByCustomerId(customerId: number): Promise<Order[]> {
  const orderRepository = AppDataSource.getRepository(Order);
  const orders = await orderRepository.find({
    where: { customer_id: customerId },
  });
  return orders;
}
