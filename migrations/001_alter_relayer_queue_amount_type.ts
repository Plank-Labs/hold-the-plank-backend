import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.changeColumn('relayer_queue', 'amount', {
    type: DataTypes.STRING(78),
    allowNull: false,
    comment: 'Amount in wei as string (supports large bigint values)',
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.changeColumn('relayer_queue', 'amount', {
    type: DataTypes.DECIMAL(36, 18),
    allowNull: false,
    comment: 'Amount in wei (18 decimals)',
  });
}
