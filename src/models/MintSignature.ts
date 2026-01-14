import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface MintSignatureAttributes {
  id: number;
  user_id: number;
  wallet_address: string;
  token_id: number;
  nonce: number;
  deadline: Date;
  signature: string;
  status: 'pending' | 'used' | 'expired';
  created_at: Date;
  used_at: Date | null;
  tx_hash: string | null;
}

interface MintSignatureCreationAttributes
  extends Optional<
    MintSignatureAttributes,
    'id' | 'status' | 'created_at' | 'used_at' | 'tx_hash'
  > {}

class MintSignature
  extends Model<MintSignatureAttributes, MintSignatureCreationAttributes>
  implements MintSignatureAttributes
{
  public id!: number;
  public user_id!: number;
  public wallet_address!: string;
  public token_id!: number;
  public nonce!: number;
  public deadline!: Date;
  public signature!: string;
  public status!: 'pending' | 'used' | 'expired';
  public created_at!: Date;
  public used_at!: Date | null;
  public tx_hash!: string | null;
}

MintSignature.init(
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
    token_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Relic ID (1-5: Bronze Shield, Silver Helmet, Gold Sword, Diamond Crown, Kronos Slayer)',
    },
    nonce: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    deadline: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    signature: {
      type: DataTypes.STRING(132),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'pending',
      comment: 'pending, used, expired',
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    tx_hash: {
      type: DataTypes.STRING(66),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'mint_signatures',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'token_id'],
        name: 'unique_user_token',
      },
      { fields: ['status'] },
      { fields: ['wallet_address'] },
    ],
  }
);

export default MintSignature;
