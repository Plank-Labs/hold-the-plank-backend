import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface RelayerQueueAttributes {
  id: number;
  user_id: number;
  wallet_address: string;
  amount: string;
  reason: string;
  session_id: number | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: Date;
  processed_at: Date | null;
  tx_hash: string | null;
  error_message: string | null;
  retry_count: number;
}

interface RelayerQueueCreationAttributes
  extends Optional<
    RelayerQueueAttributes,
    'id' | 'session_id' | 'status' | 'created_at' | 'processed_at' | 'tx_hash' | 'error_message' | 'retry_count'
  > {}

class RelayerQueue
  extends Model<RelayerQueueAttributes, RelayerQueueCreationAttributes>
  implements RelayerQueueAttributes
{
  public id!: number;
  public user_id!: number;
  public wallet_address!: string;
  public amount!: string;
  public reason!: string;
  public session_id!: number | null;
  public status!: 'pending' | 'processing' | 'completed' | 'failed';
  public created_at!: Date;
  public processed_at!: Date | null;
  public tx_hash!: string | null;
  public error_message!: string | null;
  public retry_count!: number;
}

RelayerQueue.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    wallet_address: {
      type: DataTypes.STRING(42),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(36, 18),
      allowNull: false,
      comment: 'Amount in wei (18 decimals)',
    },
    reason: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'SESSION_REWARD, GYM_BONUS, STREAK_BONUS, etc.',
    },
    session_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'pending',
      comment: 'pending, processing, completed, failed',
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    tx_hash: {
      type: DataTypes.STRING(66),
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    retry_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'relayer_queue',
    timestamps: false,
    indexes: [
      { fields: ['status'] },
      { fields: ['user_id'] },
    ],
  }
);

export default RelayerQueue;
