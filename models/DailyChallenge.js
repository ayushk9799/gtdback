import mongoose from "mongoose";

const DailyChallengeSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
    index: true,
    validate: {
      validator: function(v) {
        // Validate YYYY-MM-DD format
        return /^\d{4}-\d{2}-\d{2}$/.test(v);
      },
      message: 'Date must be in YYYY-MM-DD format'
    }
  },
  
  // The case data for this daily challenge
  caseData: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  
  // Additional metadata
  metadata: {
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    category: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
DailyChallengeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get today's challenge based on user's timezone
DailyChallengeSchema.statics.getTodaysChallenge = function(userTimezone = 'UTC') {
  // Get current date in user's timezone
  const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: userTimezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const userToday = formatter.format(new Date());
  return this.findOne({ date: userToday });
};

// Static method to get challenge by date with timezone validation
DailyChallengeSchema.statics.getChallengeByDate = function(requestedDate, userTimezone = 'UTC') {
  // Get current date in user's timezone
  const now = new Date();
  const userDate = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
  const todayStr = userDate.toISOString().split('T')[0];
  
  // Parse the requested date
  const requested = new Date(requestedDate + 'T00:00:00.000Z');
  const todayDate = new Date(todayStr + 'T00:00:00.000Z');
  
  // Calculate difference in days
  const diffTime = Math.abs(requested - todayDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Check if within ±2 days
  if (diffDays > 2) {
    throw new Error('Date is outside allowed range (±2 days from today)');
  }
  
  return this.findOne({ date: requestedDate });
};

const DailyChallenge = mongoose.model("DailyChallenge", DailyChallengeSchema);

export default DailyChallenge;
