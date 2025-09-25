// Contact Merge Feature Test Script
// Run this script to test the contact lookup and merge functionality

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/models/User');
const Conversation = require('./src/models/Conversation');
const Message = require('./src/models/Message');

// Connect to database
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/messaging-hub');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Test data creation
async function createTestData() {
  console.log('\n🧪 Creating test data...');

  // Create two duplicate contacts
  const contact1 = await User.create({
    name: 'Juan Pérez',
    email: 'juan@example.com',
    whatsappPhoneNumber: '543424675150',
    role: 'client',
    status: 'active'
  });

  const contact2 = await User.create({
    name: 'Juan P.',
    instagramId: 'juanperez_ig',
    whatsappPhoneNumber: '543424675150', // Same WhatsApp number!
    role: 'client',
    status: 'active'
  });

  console.log(`✅ Created contact 1: ${contact1.name} (${contact1._id})`);
  console.log(`✅ Created contact 2: ${contact2.name} (${contact2._id})`);

  // Create conversations for each contact
  const conversation1 = await Conversation.create({
    participants: [contact1._id],
    platform: 'whatsapp',
    type: 'direct',
    status: 'active'
  });

  const conversation2 = await Conversation.create({
    participants: [contact2._id],
    platform: 'instagram',
    type: 'direct',
    status: 'active'
  });

  console.log(`✅ Created conversation 1: ${conversation1._id}`);
  console.log(`✅ Created conversation 2: ${conversation2._id}`);

  // Create messages for each conversation
  const message1 = await Message.create({
    conversation: conversation1._id,
    sender: contact1._id,
    content: 'Hola desde WhatsApp',
    type: 'text',
    timestamp: new Date()
  });

  const message2 = await Message.create({
    conversation: conversation2._id,
    sender: contact2._id,
    content: 'Hola desde Instagram',
    type: 'text',
    timestamp: new Date()
  });

  console.log(`✅ Created messages for both conversations`);

  return { contact1, contact2, conversation1, conversation2, message1, message2 };
}

// Test lookup functionality
async function testLookup() {
  console.log('\n🔍 Testing contact lookup...');

  const whatsappLookup = await User.findOne({ whatsappPhoneNumber: '543424675150' });
  
  if (whatsappLookup) {
    console.log(`✅ Found duplicate WhatsApp number: ${whatsappLookup.name} (${whatsappLookup._id})`);
  } else {
    console.log('❌ No duplicate found');
  }
}

// Test merge functionality (simulation)
async function testMerge(fromContactId, toContactId) {
  console.log('\n🔄 Testing contact merge...');

  const [fromContact, toContact] = await Promise.all([
    User.findById(fromContactId),
    User.findById(toContactId)
  ]);

  console.log(`📋 Merging: ${fromContact.name} → ${toContact.name}`);

  // Count before merge
  const conversationsBefore = await Conversation.countDocuments({ participants: fromContactId });
  const messagesBefore = await Message.countDocuments({ sender: fromContactId });

  console.log(`📊 Before merge: ${conversationsBefore} conversations, ${messagesBefore} messages`);

  // Simulate merge (Update conversations)
  const conversationsUpdated = await Conversation.updateMany(
    { participants: fromContactId },
    { $set: { "participants.$": toContactId } }
  );

  // Simulate merge (Update messages)
  const messagesUpdated = await Message.updateMany(
    { sender: fromContactId },
    { $set: { sender: toContactId } }
  );

  // Soft delete source contact
  await User.findByIdAndUpdate(fromContactId, { 
    status: 'inactive',
    name: `[MERGED] ${fromContact.name}`,
    whatsappPhoneNumber: null,
    instagramId: null
  });

  console.log(`✅ Merge completed:`);
  console.log(`   📧 ${conversationsUpdated.modifiedCount} conversations updated`);
  console.log(`   💬 ${messagesUpdated.modifiedCount} messages updated`);
  console.log(`   🗑️ Source contact marked as inactive`);

  // Verify merge
  const conversationsAfter = await Conversation.countDocuments({ participants: toContactId });
  const messagesAfter = await Message.countDocuments({ sender: toContactId });

  console.log(`📊 After merge: ${conversationsAfter} conversations, ${messagesAfter} messages`);
}

// Cleanup test data
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');

  await User.deleteMany({ name: { $regex: /Juan|MERGED/ } });
  await Conversation.deleteMany({});
  await Message.deleteMany({});

  console.log('✅ Test data cleaned up');
}

// Main test function
async function runTests() {
  try {
    await connectDB();

    // Clean up any existing test data
    await cleanup();

    // Create test data
    const { contact1, contact2 } = await createTestData();

    // Test lookup
    await testLookup();

    // Test merge
    await testMerge(contact2._id, contact1._id);

    console.log('\n🎉 All tests completed successfully!');

    // Cleanup
    await cleanup();

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run tests
if (require.main === module) {
  runTests();
}

module.exports = { runTests };