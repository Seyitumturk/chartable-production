import mongoose, { Schema, Document } from 'mongoose';
import validator from 'validator';

export interface IUser extends Document {
  username: string;
  clerkId: string;
  firstName: string;
  lastName: string;
  email: string;
  stripeCustomerId?: string;
  wordCountBalance: number;
  hasStarterPlan: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
    trim: true,
  },
  clerkId: {
    type: String,
    required: true,
    unique: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: (email: string) => validator.isEmail(email),
      message: (props: { value: string }) => `${props.value} is not a valid email address!`,
    },
  },
  stripeCustomerId: {
    type: String,
    required: false,
  },
  wordCountBalance: {
    type: Number,
    default: 5000,
  },
  hasStarterPlan: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

export default mongoose.models.User || mongoose.model<IUser>('User', userSchema); 