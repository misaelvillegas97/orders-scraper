import { Column, Entity, OneToMany, PrimaryColumn, Unique } from 'typeorm';
import { v4 }                                               from 'uuid';
import { ClientProductEntity }                              from '@modules/products/domain/entities/client-product.entity';

@Entity({name: 'products'})
@Unique([ 'upcCode' ])
export class ProductEntity {
  @PrimaryColumn({type: 'uuid'})
  id: string = v4();

  @Column()
  upcCode: string;

  @Column()
  name: string;

  @Column({nullable: true})
  description?: string;

  @Column()
  unitaryPrice: number;

  @OneToMany(() => ClientProductEntity, (productClient) => productClient.product)
  clients: ClientProductEntity[];
}
