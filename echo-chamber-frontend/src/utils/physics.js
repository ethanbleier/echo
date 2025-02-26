// This file would contain more complex physics calculations
// For this prototype, we'll include some basic utility functions

/**
 * Calculate reflection vector
 * @param {THREE.Vector3} direction - Incoming direction
 * @param {THREE.Vector3} normal - Surface normal
 * @returns {THREE.Vector3} - Reflected direction
 */
export function calculateReflection(direction, normal) {
    // R = D - 2(D·N)N
    return direction.clone().sub(
        normal.clone().multiplyScalar(2 * direction.dot(normal))
    );
}

/**
 * Calculate damping based on material
 * @param {Object} material - Material properties
 * @param {THREE.Vector3} velocity - Current velocity
 * @returns {THREE.Vector3} - Damped velocity
 */
export function calculateDamping(material, velocity) {
    // Apply material-specific damping
    const dampingFactor = material.absorption || 0.1;
    return velocity.clone().multiplyScalar(1 - dampingFactor);
}

/**
 * Calculate amplification for sonic pulse
 * @param {Object} material - Material properties
 * @param {Number} currentDamage - Current damage value
 * @returns {Number} - Amplified damage
 */
export function calculateAmplification(material, currentDamage) {
    // Apply material-specific amplification
    const amplificationFactor = material.amplification || 1.0;
    return currentDamage * amplificationFactor;
}

/**
 * Check if a line segment intersects a sphere
 * @param {THREE.Vector3} start - Line start point
 * @param {THREE.Vector3} end - Line end point
 * @param {THREE.Vector3} sphereCenter - Sphere center
 * @param {Number} sphereRadius - Sphere radius
 * @returns {Boolean} - True if intersecting
 */
export function lineIntersectsSphere(start, end, sphereCenter, sphereRadius) {
    // Calculate line segment direction and length
    const direction = end.clone().sub(start);
    const lineLength = direction.length();
    direction.normalize();
    
    // Calculate vector from line start to sphere center
    const startToSphere = sphereCenter.clone().sub(start);
    
    // Calculate projection of startToSphere onto line direction
    const projection = startToSphere.dot(direction);
    
    // Find closest point on line to sphere center
    let closestPoint;
    if (projection < 0) {
        closestPoint = start.clone();
    } else if (projection > lineLength) {
        closestPoint = end.clone();
    } else {
        closestPoint = start.clone().add(direction.clone().multiplyScalar(projection));
    }
    
    // Calculate distance from closest point to sphere center
    const distance = closestPoint.distanceTo(sphereCenter);
    
    // Return true if distance is less than sphere radius
    return distance < sphereRadius;
}