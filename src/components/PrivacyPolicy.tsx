import React from 'react';
import { format } from 'date-fns';

export default function PrivacyPolicy() {
  const lastUpdated = format(new Date(), 'MMMM d, yyyy');
  
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
      <div className="prose max-w-none space-y-6 text-gray-600">
        <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Introduction</h2>
          <p>
            Welcome to mineoppskrifter.netlify.app ("the Application"). Your privacy is important to us. 
            This Privacy Policy explains how we collect, use, and store your personal data when using our Application.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Data Collection</h2>
          <p>We collect and store the following information:</p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>User-submitted recipes, including ingredients, instructions, and related notes</li>
            <li>Optional user-provided information such as recipe categories, tags, and images</li>
            <li>Email addresses if provided for account creation or communication purposes</li>
            <li>Usage data, including interactions with the Application, for improving user experience</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Purpose of Data Collection</h2>
          <p>We collect data for the following purposes:</p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>To store and display user-submitted recipes</li>
            <li>To improve the functionality and user experience of the Application</li>
            <li>To enable recipe sharing features if applicable</li>
            <li>To provide customer support and respond to inquiries</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Data Storage and Security</h2>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>All data is stored securely and protected using industry-standard security measures</li>
            <li>Recipes and related data may be stored in cloud-based databases</li>
            <li>We do not sell or share user data with third parties without explicit consent, except when required by law</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">User Rights and Control</h2>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>Users can request to delete their stored recipes and personal data</li>
            <li>Users may update or modify submitted recipes as needed</li>
            <li>Users can contact us for data-related inquiries via email</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Third-Party Services</h2>
          <p>
            The Application may use third-party services for hosting, analytics, and storage. 
            These services adhere to their own privacy policies.
          </p>
          <p className="mt-2">
            We are not responsible for third-party service policies, but we ensure that they 
            comply with data protection regulations.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Changes to this Privacy Policy</h2>
          <p>
            We may update this policy from time to time. Any changes will be posted on this page 
            with an updated revision date.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Contact Information</h2>
          <p>
            If you have any questions regarding this Privacy Policy, please contact us at{' '}
            <a href="mailto:oppskrifter@persline.com" className="text-indigo-600 hover:text-indigo-500">
              oppskrifter@persline.com
            </a>
          </p>
        </section>

        <p className="mt-8 text-sm text-gray-500">
          By using mineoppskrifter.netlify.app, you agree to the terms outlined in this Privacy Policy.
        </p>
      </div>
    </div>
  );
}