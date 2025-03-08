import mongoose, { Schema, Document, Types } from 'mongoose';

interface IHistoryItem {
  _id?: Types.ObjectId;
  prompt?: string;
  diagram: string;
  updateType: 'chat' | 'code' | 'reversion';
  diagram_img?: string;
  updatedAt: Date;
}

export interface IProject extends Document {
  title: string;
  projectDescription?: string;
  userId: Types.ObjectId;
  diagramSVG?: string;
  diagramType: string;
  history: IHistoryItem[];
  createdAt: Date;
  updatedAt: Date;
  currentDiagram: string;
  canvasState?: string;
}

export enum DiagramType {
  FLOWCHART = 'flowchart',
  SEQUENCE = 'sequence',
  CLASS = 'class',
  STATE = 'state',
  ER = 'er',
  ERD = 'erd',
  GANTT = 'gantt',
  PIE = 'pie',
  MINDMAP = 'mindmap',
  TIMELINE = 'timeline',
  ARCHITECTURE = 'architecture',
  ARCHITECTURE_BETA = 'architecture-beta',
  USER_JOURNEY = 'user_journey',
  QUADRANT = 'quadrant',
  REQUIREMENT = 'requirement',
  C4_DIAGRAM = 'c4_diagram',
  SANKEY = 'sankey',
  GIT = 'git',
  INTERACTIVE = 'interactive',
}

const projectSchema = new Schema<IProject>({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  projectDescription: {
    type: String,
    required: false,
    trim: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  diagramSVG: {
    type: String,
    required: false,
  },
  diagramType: {
    type: String,
    required: true,
    enum: [
      'erd',
      'flowchart',
      'sequence',
      'class',
      'state',
      'user_journey',
      'gantt',
      'quadrant',
      'requirement',
      'c4_diagram',
      'mindmap',
      'timeline',
      'sankey',
      'git',
      'architecture',
      'architecture-beta',
      'interactive'
    ],
  },
  history: [{
    _id: {
      type: Schema.Types.ObjectId,
      auto: true,
    },
    prompt: { type: String },
    diagram: {
      type: String,
    },
    updateType: {
      type: String,
      required: true,
      enum: ['chat', 'code', 'reversion'],
      default: 'chat',
    },
    diagram_img: {
      type: String,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  currentDiagram: {
    type: String,
    required: false,
  },
  canvasState: {
    type: String,
    required: false,
  },
}, {
  timestamps: true,
});

export default mongoose.models.Project || mongoose.model<IProject>('Project', projectSchema); 